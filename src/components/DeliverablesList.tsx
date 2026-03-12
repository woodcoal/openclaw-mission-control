/**
 * DeliverablesList Component
 * Displays deliverables (files, URLs, artifacts) for a task
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Link as LinkIcon, Package, ExternalLink, Eye } from 'lucide-react';
import { debug } from '@/lib/debug';
import type { TaskDeliverable } from '@/lib/types';
import { useTranslations, useLocale } from 'next-intl';

interface DeliverablesListProps {
  taskId: string;
}

/**
 * 任务交付物列表组件。
 * 显示任务关联的文件、链接或构件，支持在浏览器中预览或在文件管理器中定位。
 */
export function DeliverablesList({ taskId }: DeliverablesListProps) {
  const t = useTranslations('Deliverables');
  const locale = useLocale();
  
  const [deliverables, setDeliverables] = useState<TaskDeliverable[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 加载交付物数据。
   */
  const loadDeliverables = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/deliverables`);
      if (res.ok) {
        const data = await res.json();
        setDeliverables(data);
      }
    } catch (error) {
      console.error('Failed to load deliverables:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadDeliverables();
  }, [loadDeliverables]);

  /**
   * 根据类型获取交付物图标。
   */
  const getDeliverableIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileText className="w-5 h-5" />;
      case 'url':
        return <LinkIcon className="w-5 h-5" />;
      case 'artifact':
        return <Package className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  /**
   * 处理交付物的打开逻辑。
   */
  const handleOpen = async (deliverable: TaskDeliverable) => {
    // 链接类型直接在新窗口打开
    if (deliverable.deliverable_type === 'url' && deliverable.path) {
      window.open(deliverable.path, '_blank');
      return;
    }

    // 文件类型尝试在文件管理器（如 Finder）中显示
    if (deliverable.path) {
      try {
        debug.file('Opening file in Finder', { path: deliverable.path });
        const res = await fetch('/api/files/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: deliverable.path }),
        });

        if (res.ok) {
          debug.file('Opened in Finder successfully');
          return;
        }

        const error = await res.json();
        debug.file('Failed to open', error);

        if (res.status === 404) {
          alert(`${t('fileNotFound')}:\n${deliverable.path}\n\n${t('fileNotFoundDesc')}`);
        } else if (res.status === 403) {
          alert(`${t('cannotOpen')}:\n${deliverable.path}\n\n${t('cannotOpenDesc')}`);
        } else {
          throw new Error(error.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Failed to open file:', error);
        // 降级处理：复制路径到剪贴板
        try {
          await navigator.clipboard.writeText(deliverable.path);
          alert(`${t('pathCopied')}\n${deliverable.path}`);
        } catch {
          alert(`${t('filePath')}\n${deliverable.path}`);
        }
      }
    }
  };

  /**
   * 处理交付物的预览逻辑。
   */
  const handlePreview = (deliverable: TaskDeliverable) => {
    if (deliverable.path) {
      debug.file('Opening preview', { path: deliverable.path });
      window.open(`/api/files/preview?path=${encodeURIComponent(deliverable.path)}`, '_blank');
    }
  };

  /**
   * 格式化时间戳。
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-mc-text-secondary italic">{t('loading')}</div>
      </div>
    );
  }

  if (deliverables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-mc-text-secondary">
        <div className="text-5xl mb-4 grayscale">📦</div>
        <p className="font-medium">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deliverables.map((deliverable) => (
        <div
          key={deliverable.id}
          className="group flex gap-3 p-4 bg-mc-bg rounded-lg border border-mc-border hover:border-mc-accent/50 hover:bg-mc-bg-tertiary/20 transition-all"
        >
          {/* 类型图标 */}
          <div className="flex-shrink-0 text-mc-accent mt-0.5">
            {getDeliverableIcon(deliverable.deliverable_type)}
          </div>

          {/* 内容区域 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              {deliverable.deliverable_type === 'url' && deliverable.path ? (
                <a
                  href={deliverable.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-mc-accent hover:text-mc-accent/80 hover:underline flex items-center gap-1.5 truncate"
                >
                  {deliverable.title}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <h4 className="font-semibold text-mc-text truncate">{deliverable.title}</h4>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* 仅针对 HTML 文件的预览按钮 */}
                {deliverable.deliverable_type === 'file' && deliverable.path?.endsWith('.html') && (
                  <button
                    onClick={() => handlePreview(deliverable)}
                    className="flex-shrink-0 p-1.5 hover:bg-mc-bg-tertiary rounded text-mc-accent-cyan"
                    title={t('preview')}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                {/* 打开/定位按钮 */}
                {deliverable.path && (
                  <button
                    onClick={() => handleOpen(deliverable)}
                    className="flex-shrink-0 p-1.5 hover:bg-mc-bg-tertiary rounded text-mc-accent"
                    title={deliverable.deliverable_type === 'url' ? t('openUrl') : t('reveal')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 描述信息 */}
            {deliverable.description && (
              <p className="text-sm text-mc-text-secondary mt-1 line-clamp-2">
                {deliverable.description}
              </p>
            )}

            {/* 路径或链接地址 */}
            {deliverable.path && (
              deliverable.deliverable_type === 'url' ? (
                <a
                  href={deliverable.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 p-2 bg-mc-bg-tertiary/50 rounded text-xs text-mc-accent hover:text-mc-accent/80 font-mono break-all block truncate"
                >
                  {deliverable.path}
                </a>
              ) : (
                <div className="mt-2.5 p-2 bg-mc-bg-tertiary/50 rounded text-[11px] text-mc-text-secondary font-mono break-all truncate">
                  {deliverable.path}
                </div>
              )
            )}

            {/* 底部元数据 */}
            <div className="flex items-center gap-3 mt-3 text-[10px] text-mc-text-secondary/60 uppercase tracking-wider font-medium">
              <span className="px-1.5 py-0.5 bg-mc-bg-tertiary rounded">{deliverable.deliverable_type}</span>
              <span>•</span>
              <span>{formatTimestamp(deliverable.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
