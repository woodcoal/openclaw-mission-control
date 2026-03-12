'use client';

import { useState, useCallback } from 'react';
import { X, Save, Trash2, Activity, Package, Bot, ClipboardList, Plus, Users, ImageIcon } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import { triggerAutoDispatch, shouldTriggerAutoDispatch } from '@/lib/auto-dispatch';
import { ActivityLog } from './ActivityLog';
import { DeliverablesList } from './DeliverablesList';
import { SessionsList } from './SessionsList';
import { PlanningTab } from './PlanningTab';
import { TeamTab } from './TeamTab';
import { AgentModal } from './AgentModal';
import { TaskImages } from './TaskImages';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { useTranslations } from 'next-intl';

type TabType = 'overview' | 'planning' | 'team' | 'activity' | 'deliverables' | 'images' | 'sessions';

interface TaskModalProps {
  task?: Task;
  onClose: () => void;
  workspaceId?: string;
}

/**
 * 任务模态框组件。
 * 提供任务创建、编辑及详情查看（包括规划、动态、交付物等）。
 */
export function TaskModal({ task, onClose, workspaceId }: TaskModalProps) {
  const t = useTranslations('TaskModal');
  const common = useTranslations('Common');
  const taskT = useTranslations('Tasks');
  const prT = useTranslations('Priority');
  
  const { agents, addTask, updateTask, addEvent } = useMissionControl();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [usePlanningMode, setUsePlanningMode] = useState(false);
  
  // 如果任务处于规划状态，自动切换到规划标签页
  const [activeTab, setActiveTab] = useState<TabType>(task?.status === 'planning' ? 'planning' : 'overview');

  /**
   * 当规划规格被锁定时，刷新页面以同步数据。
   */
  const handleSpecLocked = useCallback(() => {
    window.location.reload();
  }, []);

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'normal' as TaskPriority,
    status: task?.status || 'inbox' as TaskStatus,
    assigned_agent_id: task?.assigned_agent_id || '',
    due_date: task?.due_date || '',
  });

  /**
   * 根据当前表单状态解析任务的最终状态。
   */
  const resolveStatus = (): TaskStatus => {
    if (!task && usePlanningMode) return 'planning';
    const hasAgent = !!form.assigned_agent_id;
    if (!task) {
      return hasAgent ? 'assigned' : 'inbox';
    }
    if (task.status === 'inbox' && hasAgent) return 'assigned';
    return form.status;
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * 处理表单提交。
   */
  const handleSubmit = async (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSaveError(null);

    try {
      const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
      const method = task ? 'PATCH' : 'POST';
      const resolvedStatus = resolveStatus();

      const payload = {
        ...form,
        status: resolvedStatus,
        assigned_agent_id: form.assigned_agent_id || null,
        due_date: form.due_date || null,
        workspace_id: workspaceId || task?.workspace_id || 'default',
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        setSaveError(errData.error || `Save failed (${res.status})`);
        return;
      }

      const savedTask = await res.json();

      if (task) {
        updateTask(savedTask);

        if (shouldTriggerAutoDispatch(task.status, savedTask.status, savedTask.assigned_agent_id)) {
          triggerAutoDispatch({
            taskId: savedTask.id,
            taskTitle: savedTask.title,
            agentId: savedTask.assigned_agent_id,
            agentName: savedTask.assigned_agent?.name || 'Unknown Agent',
            workspaceId: savedTask.workspace_id
          }).catch((err) => console.error('Auto-dispatch failed:', err));
        }

        onClose();
        return;
      }

      addTask(savedTask);
      addEvent({
        id: savedTask.id + '-created',
        type: 'task_created',
        task_id: savedTask.id,
        message: `New task: ${savedTask.title}`,
        created_at: new Date().toISOString(),
      });

      if (usePlanningMode) {
        fetch(`/api/tasks/${savedTask.id}/planning`, { method: 'POST' })
          .catch((error) => console.error('Failed to start planning:', error));
        onClose();
        return;
      }

      if (savedTask.assigned_agent_id && savedTask.status === 'assigned') {
        triggerAutoDispatch({
          taskId: savedTask.id,
          taskTitle: savedTask.title,
          agentId: savedTask.assigned_agent_id,
          agentName: savedTask.assigned_agent?.name || 'Unknown Agent',
          workspaceId: savedTask.workspace_id
        }).catch((err) => console.error('Auto-dispatch failed:', err));
      }

      if (keepOpen) {
        setForm({
          title: '',
          description: '',
          priority: 'normal' as TaskPriority,
          status: 'inbox' as TaskStatus,
          assigned_agent_id: '',
          due_date: '',
        });
        setUsePlanningMode(false);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save task:', error);
      setSaveError(error instanceof Error ? error.message : 'Network error — please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 处理任务删除。
   */
  const handleDelete = async () => {
    if (!task || !confirm(`${common('delete')} "${task.title}"?`)) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      if (res.ok) {
        useMissionControl.setState((state) => ({
          tasks: state.tasks.filter((t) => t.id !== task.id),
        }));
        onClose();
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

  const tabs = [
    { id: 'overview' as TabType, label: t('overview'), icon: null },
    { id: 'planning' as TabType, label: t('planning'), icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'team' as TabType, label: t('team'), icon: <Users className="w-4 h-4" /> },
    { id: 'activity' as TabType, label: t('activity'), icon: <Activity className="w-4 h-4" /> },
    { id: 'deliverables' as TabType, label: t('deliverables'), icon: <Package className="w-4 h-4" /> },
    { id: 'images' as TabType, label: t('images'), icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'sessions' as TabType, label: t('sessions'), icon: <Bot className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-t-xl sm:rounded-lg w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mc-border flex-shrink-0">
          <h2 className="text-lg font-semibold truncate px-1">
            {task ? task.title : taskT('createTask')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-mc-bg-tertiary rounded shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs - 仅对已有任务显示 */}
        {task && (
          <div className="flex border-b border-mc-border flex-shrink-0 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 min-h-11 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-mc-accent border-b-2 border-mc-accent'
                    : 'text-mc-text-secondary hover:text-mc-text'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">{taskT('title')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="w-full min-h-11 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
              placeholder={taskT('placeholder')}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">{taskT('description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent resize-none"
              placeholder={taskT('details')}
            />
          </div>

          {/* Planning Mode Toggle - 仅限新任务 */}
          {!task && (
            <div className="p-3 bg-mc-bg rounded-lg border border-mc-border">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePlanningMode}
                  onChange={(e) => setUsePlanningMode(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-mc-border"
                />
                <div>
                  <span className="font-medium text-sm flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-mc-accent" />
                    {t('enablePlanning')}
                  </span>
                  <p className="text-xs text-mc-text-secondary mt-1">
                    {t('planningHint')}
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Assigned Agent */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('assignTo')}</label>
            <select
              value={form.assigned_agent_id}
              onChange={(e) => {
                if (e.target.value === '__add_new__') {
                  setShowAgentModal(true);
                } else {
                  setForm({ ...form, assigned_agent_id: e.target.value });
                }
              }}
              className="w-full min-h-11 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
            >
              <option value="">{t('unassigned')}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.avatar_emoji} {agent.name} - {agent.role}
                </option>
              ))}
              <option value="__add_new__" className="text-mc-accent">
                {t('addNewAgent')}
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-1">{taskT('priority')}</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="w-full min-h-11 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {prT(p).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium mb-1">{taskT('dueDate')}</label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full min-h-11 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
              />
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
              <span className="text-sm text-red-400">{saveError}</span>
            </div>
          )}
            </form>
          )}

          {/* Planning Tab */}
          {activeTab === 'planning' && task && (
            <PlanningTab
              taskId={task.id}
              onSpecLocked={handleSpecLocked}
            />
          )}

          {/* Team Tab */}
          {activeTab === 'team' && task && (
            <TeamTab taskId={task.id} workspaceId={workspaceId || task.workspace_id || 'default'} />
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && task && (
            <ActivityLog taskId={task.id} />
          )}

          {/* Deliverables Tab */}
          {activeTab === 'deliverables' && task && (
            <DeliverablesList taskId={task.id} />
          )}

          {/* Images Tab */}
          {activeTab === 'images' && task && (
            <TaskImages taskId={task.id} />
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && task && (
            <SessionsList taskId={task.id} />
          )}
        </div>

        {/* Footer - 仅在概览标签页显示 */}
        {activeTab === 'overview' && (
          <div className="flex items-center justify-between p-4 border-t border-mc-border flex-shrink-0">
            <div className="flex gap-2">
              {task && (
                <>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="min-h-11 flex items-center gap-2 px-3 py-2 text-mc-accent-red hover:bg-mc-accent-red/10 rounded text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    {common('delete')}
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-4 py-2 text-sm text-mc-text-secondary hover:text-mc-text"
              >
                {common('cancel')}
              </button>
              {!task && (
                <button
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={isSubmitting}
                  className="min-h-11 flex items-center gap-2 px-4 py-2 border border-mc-accent text-mc-accent rounded text-sm font-medium hover:bg-mc-accent/10 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? common('saving') : taskT('saveAndNew')}
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="min-h-11 flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? common('saving') : common('save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 用于行内创建助手的嵌套助手模态框 */}
      {showAgentModal && (
        <AgentModal
          workspaceId={workspaceId}
          onClose={() => setShowAgentModal(false)}
          onAgentCreated={(agentId) => {
            // 自动选择新创建的助手
            setForm({ ...form, assigned_agent_id: agentId });
            setShowAgentModal(false);
          }}
        />
      )}
    </div>
  );
}
