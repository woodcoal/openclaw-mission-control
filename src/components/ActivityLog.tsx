/**
 * ActivityLog Component
 * Displays chronological activity log for a task
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { TaskActivity } from '@/lib/types';

interface ActivityLogProps {
  taskId: string;
}

/**
 * 任务活动日志组件。
 * 长期按时间顺序显示任务的各项活动记录，支持自动轮询更新。
 */
export function ActivityLog({ taskId }: ActivityLogProps) {
  const t = useTranslations('Activity');
  
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastCountRef = useRef(0);

  /**
   * 加载任务活动记录。
   * @param {boolean} showLoading - 是否显示加载动画。
   */
  const loadActivities = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);

      const res = await fetch(`/api/tasks/${taskId}/activities`);
      const data = await res.json();

      if (res.ok) {
        setActivities(data);
        lastCountRef.current = data.length;
      }
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // 初始加载
  useEffect(() => {
    loadActivities(true);
  }, [taskId, loadActivities]);

  /**
   * 轮询新活动记录。
   */
  const pollForActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/activities`);
      if (res.ok) {
        const data = await res.json();
        // 仅在有新活动时更新状态
        if (data.length !== lastCountRef.current) {
          setActivities(data);
          lastCountRef.current = data.length;
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, [taskId]);

  // 任务进行期间，每 5 秒轮询一次新动态
  useEffect(() => {
    const pollInterval = setInterval(pollForActivities, 5000);
    pollingRef.current = pollInterval;

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [taskId, pollForActivities]);

  /**
   * 获取活动类型对应的图标。
   */
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'spawned':
        return '🚀';
      case 'updated':
        return '✏️';
      case 'completed':
        return '✅';
      case 'file_created':
        return '📄';
      case 'status_changed':
        return '🔄';
      default:
        return '📝';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-mc-text-secondary">{t('loadingActivities')}</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-mc-text-secondary">
        <div className="text-4xl mb-2">📝</div>
        <p>{t('noActivityTask')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex gap-3 p-3 bg-mc-bg rounded-lg border border-mc-border"
        >
          {/* 图标 */}
          <div className="text-2xl flex-shrink-0">
            {getActivityIcon(activity.activity_type)}
          </div>

          {/* 内容区域 */}
          <div className="flex-1 min-w-0">
            {/* 助手信息 */}
            {activity.agent && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{activity.agent.avatar_emoji}</span>
                <span className="text-sm font-medium text-mc-text">
                  {activity.agent.name}
                </span>
              </div>
            )}

            {/* 活动消息 */}
            <p className="text-sm text-mc-text break-words">
              {activity.message}
            </p>

            {/* 元数据（可选显示） */}
            {activity.metadata && (
              <div className="mt-2 p-2 bg-mc-bg-tertiary rounded text-xs text-mc-text-secondary font-mono">
                {typeof activity.metadata === 'string' 
                  ? activity.metadata 
                  : JSON.stringify(JSON.parse(activity.metadata), null, 2)}
              </div>
            )}

            {/* 时间戳 */}
            <div className="text-xs text-mc-text-secondary mt-2">
              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
