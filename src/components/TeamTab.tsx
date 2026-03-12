'use client';

import { useState, useEffect } from 'react';
import { Users, Save, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { WorkflowTemplate, WorkflowStage } from '@/lib/types';
import { useTranslations } from 'next-intl';

interface TeamTabProps {
  taskId: string;
  workspaceId: string;
}

interface RoleAssignment {
  role: string;
  agent_id: string;
  agent_name?: string;
  agent_emoji?: string;
}

/**
 * 团队协作标签页组件。
 * 提供工作流模板选择、角色与助手的关联分配功能。
 */
export function TeamTab({ taskId, workspaceId }: TeamTabProps) {
  const t = useTranslations('Team');
  const common = useTranslations('Common');
  
  const { agents } = useMissionControl();
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载现有的角色分配和工作流模板
  useEffect(() => {
    const load = async () => {
      try {
        const [rolesRes, workflowsRes, taskRes] = await Promise.all([
          fetch(`/api/tasks/${taskId}/roles`),
          fetch(`/api/workspaces/${workspaceId}/workflows`),
          fetch(`/api/tasks/${taskId}`),
        ]);

        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(data.map((r: RoleAssignment & { agent_name: string; agent_emoji: string }) => ({
            role: r.role,
            agent_id: r.agent_id,
            agent_name: r.agent_name,
            agent_emoji: r.agent_emoji,
          })));
        }

        if (workflowsRes.ok) {
          const data = await workflowsRes.json();
          setWorkflows(data);
        }

        if (taskRes.ok) {
          const task = await taskRes.json();
          setSelectedWorkflow(task.workflow_template_id || '');
        }
      } catch (err) {
        console.error('Failed to load team data:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [taskId, workspaceId]);

  const currentWorkflow = workflows.find(w => w.id === selectedWorkflow);
  const requiredRoles = currentWorkflow
    ? currentWorkflow.stages.filter((s: WorkflowStage) => s.role).map((s: WorkflowStage) => s.role as string)
    : [];

  // 去重角色
  const uniqueRoles = Array.from(new Set(requiredRoles));

  /**
   * 处理工作流模板变更。
   */
  const handleWorkflowChange = async (templateId: string) => {
    setSelectedWorkflow(templateId);
    setError(null);

    // 更新任务的工作流模板 ID
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_template_id: templateId || null }),
      });
    } catch {
      // 尽力而为
    }

    // 如果选择了工作流，确保其阶段对应的角色槽位已存在
    const wf = workflows.find(w => w.id === templateId);
    if (wf) {
      const wfRoles = Array.from(new Set(
        wf.stages.filter((s: WorkflowStage) => s.role).map((s: WorkflowStage) => s.role as string)
      ));
      const existingRoleNames = roles.map(r => r.role);
      const newRoles = [...roles];

      for (const role of wfRoles) {
        if (!existingRoleNames.includes(role)) {
          newRoles.push({ role, agent_id: '' });
        }
      }
      setRoles(newRoles);
    }
  };

  /**
   * 处理角色对应的助手变更。
   */
  const handleRoleAgentChange = (role: string, agentId: string) => {
    setRoles(prev => {
      const existing = prev.find(r => r.role === role);
      if (existing) {
        return prev.map(r => r.role === role ? { ...r, agent_id: agentId } : r);
      }
      return [...prev, { role, agent_id: agentId }];
    });
    setSaved(false);
  };

  /**
   * 保存角色分配。
   */
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const validRoles = roles.filter(r => r.role && r.agent_id);
      const res = await fetch(`/api/tasks/${taskId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: validRoles }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save roles');
      }
    } catch (err) {
      setError('Failed to save roles');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 添加自定义角色槽位。
   */
  const addCustomRole = () => {
    setRoles(prev => [...prev, { role: '', agent_id: '' }]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 text-mc-text-secondary animate-spin" />
      </div>
    );
  }

  const missingRoles = uniqueRoles.filter(role =>
    !roles.find(r => r.role === role && r.agent_id)
  );

  return (
    <div className="space-y-6">
      {/* 工作流模板选择器 */}
      <div>
        <label className="block text-sm font-medium mb-2">{t('workflowTemplate')}</label>
        <select
          value={selectedWorkflow}
          onChange={(e) => handleWorkflowChange(e.target.value)}
          className="w-full min-h-11 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
        >
          <option value="">{t('noWorkflow')}</option>
          {workflows.map(wf => (
            <option key={wf.id} value={wf.id}>
              {wf.name}{wf.is_default ? ' (Default)' : ''} — {wf.description}
            </option>
          ))}
        </select>
      </div>

      {/* 工作流阶段可视化 */}
      {currentWorkflow && (
        <div>
          <label className="block text-sm font-medium mb-2">{t('stages')}</label>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-nowrap">
            {currentWorkflow.stages.map((stage: WorkflowStage, i: number) => (
              <div key={stage.id} className="flex items-center gap-1 flex-shrink-0">
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  stage.role
                    ? 'bg-mc-accent/10 border border-mc-accent/30 text-mc-accent'
                    : 'bg-mc-bg-tertiary border border-mc-border text-mc-text-secondary'
                }`}>
                  {stage.label}
                  {stage.role && <span className="ml-1 opacity-60">({stage.role})</span>}
                </div>
                {i < currentWorkflow.stages.length - 1 && (
                  <span className="text-mc-text-secondary/40 text-xs">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 角色缺失警告 */}
      {missingRoles.length > 0 && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg shadow-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-orange-300 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-orange-200">
                {t('missingRoles', { roles: missingRoles.join(', ') })}
              </p>
              <p className="text-xs text-orange-300/70 mt-1">
                {t('missingRolesHint')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 角色分配 */}
      <div>
        <label className="block text-sm font-medium mb-2">{t('roleAssignments')}</label>
        <div className="space-y-3">
          {(uniqueRoles.length > 0 ? uniqueRoles : roles.map(r => r.role).filter(Boolean)).map(role => {
            if (!role) return null;
            const assignment = roles.find(r => r.role === role);
            return (
              <div key={role} className="flex items-center gap-3">
                <div className="w-24 text-xs font-medium text-mc-text-secondary capitalize flex-shrink-0">
                  {role}
                </div>
                <select
                  value={assignment?.agent_id || ''}
                  onChange={(e) => handleRoleAgentChange(role, e.target.value)}
                  className="flex-1 min-h-11 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
                >
                  <option value="">{common('unassigned')}</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.avatar_emoji} {agent.name} — {agent.role}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          {/* 自定义角色槽位（非来自工作流） */}
          {roles.filter(r => !uniqueRoles.includes(r.role) && r.role).map((r, i) => (
            <div key={`custom-${i}`} className="flex items-center gap-3">
              <input
                value={r.role}
                onChange={(e) => {
                  setRoles(prev => prev.map((pr, pi) =>
                    pi === roles.indexOf(r) ? { ...pr, role: e.target.value } : pr
                  ));
                }}
                placeholder={t('customRolePlaceholder')}
                className="w-24 bg-mc-bg border border-mc-border rounded px-2 py-2 text-xs focus:outline-none focus:border-mc-accent"
              />
              <select
                value={r.agent_id}
                onChange={(e) => handleRoleAgentChange(r.role, e.target.value)}
                className="flex-1 min-h-11 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
              >
                <option value="">{common('unassigned')}</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.avatar_emoji} {agent.name} — {agent.role}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {/* Learner 角色 - 如果不在 uniqueRoles 中则始终显示 */}
          {!uniqueRoles.includes('learner') && (
            <div className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
              <div className="w-24 text-xs font-medium text-mc-text-secondary capitalize flex-shrink-0">
                learner
              </div>
              <select
                value={roles.find(r => r.role === 'learner')?.agent_id || ''}
                onChange={(e) => handleRoleAgentChange('learner', e.target.value)}
                className="flex-1 min-h-11 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
              >
                <option value="">{t('unassignedOptional')}</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.avatar_emoji} {agent.name} — {agent.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={addCustomRole}
            className="text-xs text-mc-accent hover:text-mc-accent/80 font-medium"
          >
            {t('addCustomRole')}
          </button>
        </div>
      </div>

      {/* 错误 / 成功反馈 */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {saved && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <p className="text-sm text-green-400">{t('saveSuccess')}</p>
        </div>
      )}

      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full min-h-11 flex items-center justify-center gap-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? common('saving') : t('saveTeam')}
      </button>
    </div>
  );
}
