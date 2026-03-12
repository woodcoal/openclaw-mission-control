'use client';

import { useState, useEffect } from 'react';
import { Plus, ArrowRight, Folder, Users, CheckSquare, Trash2, AlertTriangle, Activity, Settings, Edit3 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { WorkspaceStats } from '@/lib/types';
import { WorkspaceModal } from './WorkspaceModal';

/**
 * 工作区仪表盘组件。
 * 显示所有工作区的统计信息并提供创建/编辑/删除功能。
 * @returns {JSX.Element} 渲染的工作区仪表盘。
 */
export function WorkspaceDashboard() {
  const t = useTranslations('Workspace');
  const c = useTranslations('Common');
  const h = useTranslations('Header');
  
  const [workspaces, setWorkspaces] = useState<WorkspaceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceStats | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  /**
   * 从 API 加载工作区列表及其统计信息。
   */
  const loadWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces?stats=true');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦞</div>
          <p className="text-mc-text-secondary">{c('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mc-bg">
      {/* Header */}
      <header className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🦞</span>
              <h1 className="text-xl font-bold">{h('title')}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="min-h-11 w-11 flex items-center justify-center rounded-lg border border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-accent hover:border-mc-accent/50 transition-all"
                title={t('globalSettings')}
              >
                <Settings className="w-5 h-5" />
              </Link>
              <Link
                href={workspaces.length > 0 ? `/workspace/${workspaces[0].slug}/activity` : '/workspace/default/activity'}
                className="min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary flex items-center gap-2 text-sm"
              >
                <Activity className="w-4 h-4" />
                {t('activityDashboard')}
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="min-h-11 flex items-center gap-2 px-4 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90"
              >
                <Plus className="w-4 h-4" />
                {t('addWorkspace')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">{t('allWorkspaces')}</h2>
          <p className="text-mc-text-secondary">
            {t('selectWorkspaceHint')}
          </p>
        </div>

        {workspaces.length === 0 ? (
          <div className="text-center py-16">
            <Folder className="w-16 h-16 mx-auto text-mc-text-secondary mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('noWorkspaces')}</h3>
            <p className="text-mc-text-secondary mb-6">
              {t('createFirstHint')}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90"
            >
              {t('createWorkspace')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <WorkspaceCard 
                key={workspace.id} 
                workspace={workspace} 
                onDelete={(id) => setWorkspaces(workspaces.filter(w => w.id !== id))}
                onEdit={() => setEditingWorkspace(workspace)}
              />
            ))}
            
            {/* Add workspace card */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="border-2 border-dashed border-mc-border rounded-xl p-6 hover:border-mc-accent/50 transition-colors flex flex-col items-center justify-center gap-3 min-h-[172px] min-w-0"
            >
              <div className="w-12 h-12 rounded-full bg-mc-bg-tertiary flex items-center justify-center">
                <Plus className="w-6 h-6 text-mc-text-secondary" />
              </div>
              <span className="text-mc-text-secondary font-medium">{t('addWorkspace')}</span>
            </button>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <WorkspaceModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadWorkspaces();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingWorkspace && (
        <WorkspaceModal 
          workspace={editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          onSuccess={() => {
            setEditingWorkspace(null);
            loadWorkspaces();
          }}
        />
      )}
    </div>
  );
}

/**
 * 工作区卡片组件。
 * @param {Object} param - 组件属性。
 */
function WorkspaceCard({ 
  workspace, 
  onDelete, 
  onEdit 
}: { 
  workspace: WorkspaceStats; 
  onDelete: (id: string) => void;
  onEdit: () => void;
}) {
  const t = useTranslations('Workspace');
  const c = useTranslations('Common');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * 执行工作区删除操作。
   */
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(workspace.id);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete workspace');
      }
    } catch {
      alert('Failed to delete workspace');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  
  return (
    <>
    <Link href={`/workspace/${workspace.slug}`}>
      <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-4 sm:p-6 hover:border-mc-accent/50 transition-all hover:shadow-lg cursor-pointer group relative min-h-[172px]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{workspace.icon}</span>
            <div>
              <h3 className="font-semibold text-lg group-hover:text-mc-accent transition-colors">
                {workspace.name}
              </h3>
              <p className="text-sm text-mc-text-secondary">/{workspace.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 rounded hover:bg-mc-accent/20 text-mc-text-secondary hover:text-mc-accent transition-colors opacity-0 group-hover:opacity-100"
              title={c('edit')}
            >
              <Edit3 className="w-4 h-4" />
            </button>
            {workspace.id !== 'default' && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="p-1.5 rounded hover:bg-mc-accent-red/20 text-mc-text-secondary hover:text-mc-accent-red transition-colors opacity-0 group-hover:opacity-100"
                title={c('delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <ArrowRight className="w-5 h-5 text-mc-text-secondary group-hover:text-mc-accent transition-colors" />
          </div>
        </div>

        {/* Simple task/agent counts */}
        <div className="flex items-center gap-4 text-sm text-mc-text-secondary mt-4">
          <div className="flex items-center gap-1">
            <CheckSquare className="w-4 h-4" />
            <span>{t('tasksCount', { count: workspace.taskCounts.total })}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{t('agentsCount', { count: workspace.agentCount })}</span>
          </div>
        </div>
      </div>
    </Link>

    {/* Delete Confirmation Modal */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4" onClick={() => setShowDeleteConfirm(false)}>
        <div className="bg-mc-bg-secondary border border-mc-border rounded-t-xl sm:rounded-xl w-full max-w-md p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-mc-accent-red/20 rounded-full">
              <AlertTriangle className="w-6 h-6 text-mc-accent-red" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{t('deleteWorkspace')}</h3>
              <p className="text-sm text-mc-text-secondary">{t('deleteWarning')}</p>
            </div>
          </div>
          
          <p className="text-mc-text-secondary mb-6">
            Are you sure you want to delete <strong>{workspace.name}</strong>? 
            {workspace.taskCounts.total > 0 && (
              <span className="block mt-2 text-mc-accent-red">
                ⚠️ This workspace has {workspace.taskCounts.total} task(s). Delete them first.
              </span>
            )}
          </p>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-mc-text-secondary hover:text-mc-text"
            >
              {c('cancel')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || workspace.taskCounts.total > 0 || workspace.agentCount > 0}
              className="px-4 py-2 bg-mc-accent-red text-white rounded-lg font-medium hover:bg-mc-accent-red/90 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : t('deleteWorkspace')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
