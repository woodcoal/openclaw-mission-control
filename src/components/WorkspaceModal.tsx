'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Workspace, WorkspaceStats } from '@/lib/types';

/**
 * 工作区弹窗组件（支持创建和编辑）。
 * @param {Object} props - 组件属性。
 * @param {Workspace | WorkspaceStats} [props.workspace] - 如果提供，则为编辑模式。
 * @param {Function} props.onClose - 关闭弹窗的回调。
 * @param {Function} props.onSuccess - 操作成功后的回调。
 */
export function WorkspaceModal({ 
  workspace, 
  onClose, 
  onSuccess 
}: { 
  workspace?: Workspace | WorkspaceStats; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const isEditing = !!workspace;
  const t = useTranslations('Workspace');
  const c = useTranslations('Common');
  
  const [name, setName] = useState(workspace?.name || '');
  const [slug, setSlug] = useState(workspace?.slug || '');
  const [isSlugManual, setIsSlugManual] = useState(isEditing);
  const [icon, setIcon] = useState(workspace?.icon || '📁');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const icons = [
    { char: '📁', label: 'General' }, { char: '💼', label: 'Business' }, { char: '🚀', label: 'Launch' }, 
    { char: '💡', label: 'Idea' }, { char: '🎯', label: 'Goal' }, { char: '📊', label: 'Stats' }, 
    { char: '🔧', label: 'Tools' }, { char: '🌟', label: 'Star' }, { char: '🤖', label: 'AI Robot' }, 
    { char: '💻', label: 'Coding' }, { char: '🛠️', label: 'Engineering' }, { char: '📦', label: 'Package' }, 
    { char: '🧠', label: 'Intelligence' }, { char: '⚡', label: 'Fast' }, { char: '⚙️', label: 'Settings' }, 
    { char: '📈', label: 'Growth' }, { char: '🎨', label: 'Design' }, { char: '🌍', label: 'Global' }, 
    { char: '📝', label: 'Docs' }, { char: '📅', label: 'Schedule' }, { char: '💬', label: 'Chat' }, 
    { char: '✅', label: 'Done' }, { char: '🧪', label: 'Testing' }, { char: '💎', label: 'Quality' }
  ];

  /**
   * 将名称转换为 slug 格式。
   */
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  /**
   * 处理名称变更，如果未手动修改过 slug，则自动同步。
   */
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (!isSlugManual) {
      setSlug(slugify(newName));
    }
  };

  /**
   * 处理 slug 变更，并标记为手动修改。
   */
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
    setIsSlugManual(true);
  };

  /**
   * 提交表单数据。
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const url = isEditing ? `/api/workspaces/${workspace.id}` : '/api/workspaces';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          slug: slug.trim(),
          icon 
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save workspace');
      }
    } catch {
      setError('Failed to save workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4" onClick={onClose}>
      <div className="bg-mc-bg-secondary border border-mc-border rounded-t-xl sm:rounded-xl w-full max-w-md pb-[env(safe-area-inset-bottom)] sm:pb-0" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-mc-border">
          <h2 className="text-lg font-semibold">{isEditing ? t('editWorkspace') : t('createWorkspace')}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 图标选择器 */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('icon')}</label>
            <div className="flex flex-wrap gap-2">
              {icons.map((i) => (
                <button
                  key={i.char}
                  type="button"
                  onClick={() => setIcon(i.char)}
                  title={i.label}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                    icon === i.char 
                      ? 'bg-mc-accent/20 border-2 border-mc-accent' 
                      : 'bg-mc-bg border border-mc-border hover:border-mc-accent/50'
                  }`}
                >
                  {i.char}
                </button>
              ))}
            </div>
          </div>

          {/* 名称输入 */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('workspaceName')}</label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder={t('namePlaceholder')}
              className="w-full bg-mc-bg border border-mc-border rounded-lg px-4 py-2 focus:outline-none focus:border-mc-accent"
              autoFocus={!isEditing}
            />
          </div>

          {/* Slug 输入 */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('workspaceSlug')}</label>
            <p className="text-xs text-mc-text-secondary mb-2">{t('workspaceSlugHint')}</p>
            <input
              type="text"
              value={slug}
              onChange={handleSlugChange}
              placeholder="e.g., my-project"
              className="w-full bg-mc-bg border border-mc-border rounded-lg px-4 py-2 focus:outline-none focus:border-mc-accent font-mono text-sm"
            />
          </div>

          {error && (
            <div className="text-mc-accent-red text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-mc-text-secondary hover:text-mc-text"
            >
              {c('cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-6 py-2 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 disabled:opacity-50"
            >
              {isSubmitting ? c('saving') : (isEditing ? c('save') : t('createWorkspace'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
