'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, Circle, Lock, AlertCircle, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PlanningOption {
  id: string;
  label: string;
}

interface PlanningQuestion {
  question: string;
  options: PlanningOption[];
}

interface PlanningMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface PlanningState {
  taskId: string;
  sessionKey?: string;
  messages: PlanningMessage[];
  currentQuestion?: PlanningQuestion;
  isComplete: boolean;
  dispatchError?: string;
  spec?: {
    title: string;
    summary: string;
    deliverables: string[];
    success_criteria: string[];
    constraints: Record<string, unknown>;
  };
  agents?: Array<{
    name: string;
    role: string;
    avatar_emoji: string;
    soul_md: string;
    instructions: string;
  }>;
  isStarted: boolean;
}

interface PlanningTabProps {
  taskId: string;
  onSpecLocked?: () => void;
}

/**
 * 任务规划标签页组件。
 * 提供多轮问答式的任务需求规划功能，支持自动生成任务规格和助手。
 */
export function PlanningTab({ taskId, onSpecLocked }: PlanningTabProps) {
  const t = useTranslations('Planning');
  
  const [state, setState] = useState<PlanningState | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [retryingDispatch, setRetryingDispatch] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  // 用于追踪轮询状态的 Refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingWarningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingHardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const lastSubmissionRef = useRef<{ answer: string; otherText?: string } | null>(null);
  const currentQuestionRef = useRef<string | undefined>(undefined);

  /**
   * 加载规划状态（仅初始加载）。
   */
  const loadState = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/planning`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
        currentQuestionRef.current = data.currentQuestion?.question;
      }
    } catch (err) {
      console.error('Failed to load planning state:', err);
      setError(t('loading'));
    } finally {
      setLoading(false);
    }
  }, [taskId, t]);

  /**
   * 停止轮询并清除所有计时器。
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingWarningTimeoutRef.current) {
      clearTimeout(pollingWarningTimeoutRef.current);
      pollingWarningTimeoutRef.current = null;
    }
    if (pollingHardTimeoutRef.current) {
      clearTimeout(pollingHardTimeoutRef.current);
      pollingHardTimeoutRef.current = null;
    }
    setIsWaitingForResponse(false);
  }, []);

  /**
   * 通过 poll 接口轮询规划更新。
   */
  const pollForUpdates = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const res = await fetch(`/api/tasks/${taskId}/planning/poll`);
      if (res.ok) {
        const data = await res.json();

        if (data.hasUpdates) {
          setError(null);

          const newQuestion = data.currentQuestion?.question;
          const questionChanged = newQuestion && currentQuestionRef.current !== newQuestion;

          // 强制重新从服务器加载完整状态
          const freshRes = await fetch(`/api/tasks/${taskId}/planning`);
          if (freshRes.ok) {
            const freshData = await freshRes.json();
            setState(freshData);
          } else {
            setState(prev => ({
              ...prev!,
              messages: data.messages,
              isComplete: data.complete,
              spec: data.spec,
              agents: data.agents,
              currentQuestion: data.currentQuestion,
              dispatchError: data.dispatchError,
            }));
          }

          if (questionChanged) {
            currentQuestionRef.current = newQuestion;
            setSelectedOption(null);
            setOtherText('');
            setIsSubmittingAnswer(false);
          }
          if (data.currentQuestion) {
            setIsSubmittingAnswer(false);
            setSubmitting(false);
          }

          if (data.dispatchError) {
            setError(`${t('complete')} but ${data.dispatchError}`);
          }

          if (data.complete && onSpecLocked) {
            onSpecLocked();
          }

          if (data.currentQuestion || data.complete || data.dispatchError) {
            setIsWaitingForResponse(false);
            stopPolling();
          }
        }
      }
    } catch (err) {
      console.error('Failed to poll for updates:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [taskId, onSpecLocked, stopPolling, t]);

  /**
   * 启动响应轮询。
   */
  const startPolling = useCallback(() => {
    stopPolling();
    setError(null);
    setIsWaitingForResponse(true);

    pollingIntervalRef.current = setInterval(() => {
      pollForUpdates();
    }, 2000);

    pollingWarningTimeoutRef.current = setTimeout(() => {
      setError(t('processingWarning'));
    }, 90000);

    pollingHardTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setSubmitting(false);
      setIsSubmittingAnswer(false);
      setError(t('timeoutError'));
    }, 300000);
  }, [pollForUpdates, stopPolling, t]);

  useEffect(() => {
    if (state?.currentQuestion) {
      currentQuestionRef.current = state.currentQuestion.question;
    }
  }, [state]);

  useEffect(() => {
    loadState();
    return () => stopPolling();
  }, [loadState, stopPolling]);

  useEffect(() => {
    if (state && state.isStarted && !state.isComplete && !state.currentQuestion && !isWaitingForResponse) {
      startPolling();
    }
  }, [state, isWaitingForResponse, startPolling]);

  /**
   * 开启规划会话。
   */
  const startPlanning = async () => {
    setStarting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/planning`, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setState(prev => ({
          ...prev!,
          sessionKey: data.sessionKey,
          messages: data.messages || [],
          isStarted: true,
        }));
        startPolling();
      } else {
        setError(data.error || t('starting'));
      }
    } catch (err) {
      setError(t('starting'));
    } finally {
      setStarting(false);
    }
  };

  /**
   * 提交答案。
   */
  const submitAnswer = async () => {
    if (!selectedOption) return;

    setSubmitting(true);
    setIsSubmittingAnswer(true);
    setError(null);

    const submission = {
      answer: selectedOption?.toLowerCase() === 'other' ? 'other' : selectedOption,
      otherText: selectedOption?.toLowerCase() === 'other' ? otherText : undefined,
    };
    lastSubmissionRef.current = submission;

    try {
      const res = await fetch(`/api/tasks/${taskId}/planning/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });

      if (res.ok) {
        startPolling();
      } else {
        const data = await res.json();
        setError(data.error || t('sending'));
        setIsSubmittingAnswer(false);
        setSelectedOption(null);
        setOtherText('');
      }
    } catch (err) {
      setError(t('sending'));
      setIsSubmittingAnswer(false);
      setSelectedOption(null);
      setOtherText('');
    }
  };

  /**
   * 重试上一次提交。
   */
  const handleRetry = async () => {
    const submission = lastSubmissionRef.current;
    if (!submission) return;

    setSubmitting(true);
    setIsSubmittingAnswer(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/planning/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });

      if (res.ok) {
        startPolling();
      } else {
        const data = await res.json();
        setError(data.error || t('sending'));
        setIsSubmittingAnswer(false);
        setSelectedOption(null);
        setOtherText('');
      }
    } catch (err) {
      setError(t('sending'));
      setIsSubmittingAnswer(false);
      setSelectedOption(null);
      setOtherText('');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 重试任务派遣。
   */
  const retryDispatch = async () => {
    setRetryingDispatch(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/planning/retry-dispatch`, {
        method: 'POST',
      });

      if (res.ok) {
        setError(null);
      } else {
        const data = await res.json();
        setError(`${t('retryDispatch')} failed: ${data.error}`);
      }
    } catch (err) {
      setError(t('retryDispatch'));
    } finally {
      setRetryingDispatch(false);
    }
  };

  /**
   * 取消当前规划会话。
   */
  const cancelPlanning = async () => {
    if (!confirm(t('cancelConfirm'))) {
      return;
    }

    setCanceling(true);
    setError(null);
    setIsSubmittingAnswer(false);
    stopPolling();

    try {
      const res = await fetch(`/api/tasks/${taskId}/planning`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setState({
          taskId,
          isStarted: false,
          messages: [],
          isComplete: false,
        });
      } else {
        const data = await res.json();
        setError(data.error || t('canceling'));
      }
    } catch (err) {
      setError(t('canceling'));
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-mc-accent" />
        <span className="ml-2 text-mc-text-secondary">{t('loading')}</span>
      </div>
    );
  }

  // 规划完成 - 显示规格和生成的助手
  if (state?.isComplete && state?.spec) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-400">
            <Lock className="w-5 h-5" />
            <span className="font-medium">{t('complete')}</span>
          </div>
          {state.dispatchError && (
            <div className="text-right">
              <span className="text-sm text-amber-400">⚠️ {t('dispatchFailed')}</span>
            </div>
          )}
        </div>
        
        {/* 带有重试按钮的派遣错误提示 */}
        {state.dispatchError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-amber-400 text-sm font-medium mb-2">{t('dispatchFailedDesc')}</p>
                <p className="text-amber-300 text-xs mb-3">{state.dispatchError}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={retryDispatch}
                    disabled={retryingDispatch}
                    className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs rounded disabled:opacity-50 flex items-center gap-1"
                  >
                    {retryingDispatch ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t('retrying')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        {t('retryDispatch')}
                      </>
                    )}
                  </button>
                  <span className="text-amber-400 text-xs">
                    {t('retryDispatchHint')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 规格摘要 */}
        <div className="bg-mc-bg border border-mc-border rounded-lg p-4">
          <h3 className="font-medium mb-2">{state.spec.title}</h3>
          <p className="text-sm text-mc-text-secondary mb-4">{state.spec.summary}</p>
          
          {state.spec.deliverables?.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium mb-1">{t('deliverables')}</h4>
              <ul className="list-disc list-inside text-sm text-mc-text-secondary">
                {state.spec.deliverables.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          
          {state.spec.success_criteria?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">{t('successCriteria')}</h4>
              <ul className="list-disc list-inside text-sm text-mc-text-secondary">
                {state.spec.success_criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* 生成的助手 */}
        {state.agents && state.agents.length > 0 && (
          <div>
            <h3 className="font-medium mb-2">{t('agentsCreated')}</h3>
            <div className="space-y-2">
              {state.agents.map((agent, i) => (
                <div key={i} className="bg-mc-bg border border-mc-border rounded-lg p-3 flex items-center gap-3">
                  <span className="text-2xl">{agent.avatar_emoji}</span>
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-mc-text-secondary">{agent.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 未启动状态 - 显示启动按钮
  if (!state?.isStarted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">{t('startPlanning')}</h3>
          <p className="text-mc-text-secondary text-sm max-w-md">
            {t('startPlanningDesc')}
          </p>
        </div>
        
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        <button
          onClick={startPlanning}
          disabled={starting}
          className="px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-2"
        >
          {starting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('starting')}
            </>
          ) : (
            <>📋 {t('startPlanning')}</>
          )}
        </button>
      </div>
    );
  }

  // 显示当前问题
  return (
    <div className="flex flex-col h-full">
      {/* 带有取消按钮的进度指示器 */}
      <div className="p-4 border-b border-mc-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-mc-text-secondary">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
          <span>{t('inProgress')}</span>
        </div>
        <button
          onClick={cancelPlanning}
          disabled={canceling}
          className="flex items-center gap-2 px-3 py-2 text-sm text-mc-accent-red hover:bg-mc-accent-red/10 rounded disabled:opacity-50"
        >
          {canceling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('canceling')}
            </>
          ) : (
            <>
              <X className="w-4 h-4" />
              {t('retry')}
            </>
          )}
        </button>
      </div>

      {/* 问题区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {state?.currentQuestion ? (
          <div className="max-w-xl mx-auto">
            <h3 className="text-lg font-medium mb-6">
              {state.currentQuestion.question}
            </h3>

            <div className="space-y-3">
              {state.currentQuestion.options.map((option) => {
                const isSelected = selectedOption === option.label;
                const isOther = option.id === 'other' || option.label.toLowerCase() === 'other';
                const isThisOptionSubmitting = isSubmittingAnswer && isSelected;

                return (
                  <div key={option.id}>
                    <button
                      onClick={() => setSelectedOption(option.label)}
                      disabled={submitting}
                      className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                        isThisOptionSubmitting
                          ? 'border-mc-accent bg-mc-accent/20'
                          : isSelected
                          ? 'border-mc-accent bg-mc-accent/10'
                          : 'border-mc-border hover:border-mc-accent/50'
                      } disabled:opacity-50`}
                    >
                      <span className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${
                        isSelected ? 'bg-mc-accent text-mc-bg' : 'bg-mc-bg-tertiary'
                      }`}>
                        {option.id.toUpperCase()}
                      </span>
                      <span className="flex-1">{option.label}</span>
                      {isThisOptionSubmitting ? (
                        <Loader2 className="w-5 h-5 text-mc-accent animate-spin" />
                      ) : isSelected && !submitting ? (
                        <CheckCircle className="w-5 h-5 text-mc-accent" />
                      ) : null}
                    </button>

                    {/* 自定义文本输入 */}
                    {isOther && isSelected && (
                      <div className="mt-2 ml-11">
                        <input
                          type="text"
                          value={otherText}
                          onChange={(e) => setOtherText(e.target.value)}
                          placeholder={t('specifyPlaceholder')}
                          className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
                          disabled={submitting}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <div
                className={`mt-4 p-3 border rounded-lg ${
                  error.includes('still processing')
                    ? 'bg-orange-500/10 border-orange-500/40'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      error.includes('still processing') ? 'text-orange-300' : 'text-red-400'
                    }`}
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${error.includes('still processing') ? 'text-orange-200' : 'text-red-400'}`}>
                      {error}
                    </p>
                    {!isWaitingForResponse && lastSubmissionRef.current && (
                      <button
                        onClick={handleRetry}
                        disabled={submitting}
                        className={`mt-2 text-xs underline disabled:opacity-50 ${
                          error.includes('still processing')
                            ? 'text-orange-300 hover:text-orange-200'
                            : 'text-red-400 hover:text-red-300'
                        }`}
                      >
                        {submitting ? t('retrying') : t('retry')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 提交按钮 */}
            <div className="mt-6">
              <button
                onClick={submitAnswer}
                disabled={!selectedOption || submitting || (selectedOption === 'Other' && !otherText.trim())}
                className="w-full px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('sending')}
                  </>
                ) : (
                  t('continue')
                )}
              </button>

              {/* 提交后的等待指示器 */}
              {isSubmittingAnswer && !submitting && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-mc-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin text-mc-accent" />
                  <span>{t('waitingResponse')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-mc-accent mx-auto mb-2" />
              <p className="text-mc-text-secondary">
                {isWaitingForResponse ? t('waitingResponse') : t('waitingNextQuestion')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 对话历史（默认折叠） */}
      {state?.messages && state.messages.length > 0 && (
        <details className="border-t border-mc-border">
          <summary className="p-3 text-sm text-mc-text-secondary cursor-pointer hover:bg-mc-bg-tertiary">
            {t('viewConversation', { count: state.messages.length })}
          </summary>
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto bg-mc-bg">
            {state.messages.map((msg, i) => (
              <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-mc-accent' : 'text-mc-text-secondary'}`}>
                <span className="font-medium">{msg.role === 'user' ? 'You' : 'Orchestrator'}:</span>{' '}
                <span className="opacity-75">{msg.content.substring(0, 100)}...</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
