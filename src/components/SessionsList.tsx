/**
 * SessionsList Component
 * Displays OpenClaw sub-agent sessions for a task
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bot, CheckCircle, Circle, XCircle, Trash2, Check } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

interface SessionWithAgent {
  id: string;
  agent_id: string | null;
  openclaw_session_id: string;
  channel: string | null;
  status: string;
  session_type: string;
  task_id: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  agent_name?: string;
  agent_avatar_emoji?: string;
}

interface SessionsListProps {
  taskId: string;
}

/**
 * 任务子助手会话列表组件。
 * 显示与特定任务关联的所有 OpenClaw 动态会话，支持标记完成和删除会话操作。
 */
export function SessionsList({ taskId }: SessionsListProps) {
  const t = useTranslations('Sessions');
  const common = useTranslations('Common');
  const locale = useLocale();
  
  const [sessions, setSessions] = useState<SessionWithAgent[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 加载会话列表数据。
   */
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/subagent`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  /**
   * 根据会话状态获取对应的状态图标。
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Circle className="w-4 h-4 text-green-500 fill-current animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-mc-accent" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-mc-text-secondary" />;
    }
  };

  /**
   * 格式化会话持续时间。
   */
  const formatDuration = (start: string, end?: string | null) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;

    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const unitH = locale === 'zh' ? '小时' : 'h';
    const unitM = locale === 'zh' ? '分' : 'm';
    const unitS = locale === 'zh' ? '秒' : 's';

    if (hours > 0) {
      return `${hours}${unitH} ${minutes % 60}${unitM}`;
    } else if (minutes > 0) {
      return `${minutes}${unitM} ${seconds % 60}${unitS}`;
    } else {
      return `${seconds}${unitS}`;
    }
  };

  /**
   * 格式化日期时间戳。
   */
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  /**
   * 将会话标记为已完成。
   */
  const handleMarkComplete = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/openclaw/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          ended_at: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        loadSessions();
      }
    } catch (error) {
      console.error('Failed to mark session complete:', error);
    }
  };

  /**
   * 处理会话删除。
   */
  const handleDelete = async (sessionId: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      const res = await fetch(`/api/openclaw/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadSessions();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-mc-text-secondary italic">{t('loading')}</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-mc-text-secondary">
        <div className="text-5xl mb-4 grayscale">🤖</div>
        <p className="font-medium">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="group flex gap-3 p-4 bg-mc-bg rounded-lg border border-mc-border hover:border-mc-accent/30 transition-all shadow-sm"
        >
          {/* 助手头像 */}
          <div className="flex-shrink-0">
            {session.agent_avatar_emoji ? (
              <span className="text-3xl">{session.agent_avatar_emoji}</span>
            ) : (
              <Bot className="w-10 h-10 text-mc-accent" />
            )}
          </div>

          {/* 会话主要内容 */}
          <div className="flex-1 min-w-0">
            {/* 助手名称与当前状态 */}
            <div className="flex items-center gap-2 mb-1.5">
              {getStatusIcon(session.status)}
              <span className="font-semibold text-mc-text">
                {session.agent_name || t('subAgent')}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-mc-bg-tertiary rounded text-mc-text-secondary uppercase font-bold tracking-tight">
                {common(session.status)}
              </span>
            </div>

            {/* 会话 ID */}
            <div className="text-[11px] text-mc-text-secondary font-mono mb-2 truncate opacity-70">
              {t('sessionLabel')} {session.openclaw_session_id}
            </div>

            {/* 持续时间与启动时间 */}
            <div className="flex items-center gap-3 text-[11px] text-mc-text-secondary font-medium">
              <span className="flex items-center gap-1">
                {t('duration')} {formatDuration(session.created_at, session.ended_at)}
              </span>
              <span className="opacity-30">•</span>
              <span>{t('started')} {formatTimestamp(session.created_at)}</span>
            </div>

            {/* 通道信息 */}
            {session.channel && (
              <div className="mt-2 text-[11px] text-mc-text-secondary">
                {t('channel')} <span className="font-mono bg-mc-bg-tertiary px-1 rounded">{session.channel}</span>
              </div>
            )}
          </div>

          {/* 快捷操作按钮 */}
          <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {session.status === 'active' && (
              <button
                onClick={() => handleMarkComplete(session.openclaw_session_id)}
                className="p-2 hover:bg-green-500/10 rounded-lg text-green-500 transition-colors"
                title={t('markComplete')}
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleDelete(session.openclaw_session_id)}
              className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors"
              title={t('deleteSession')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
