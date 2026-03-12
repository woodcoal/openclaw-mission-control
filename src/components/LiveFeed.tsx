'use client';

import { useState } from 'react';
import { ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Event } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';

type FeedFilter = 'all' | 'tasks' | 'agents';

interface LiveFeedProps {
  mobileMode?: boolean;
  isPortrait?: boolean;
}

/**
 * 实时动态侧边栏组件。
 * 显示任务创建、分配、完成及助手状态变更等全局动态流。
 */
export function LiveFeed({ mobileMode = false, isPortrait = true }: LiveFeedProps) {
  const d = useTranslations('Dashboard');
  const c = useTranslations('Common');
  const t = useTranslations('Tasks');
  const a = useTranslations('Agents');
  const act = useTranslations('Activity');
  
  const { events } = useMissionControl();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [isMinimized, setIsMinimized] = useState(false);

  const effectiveMinimized = mobileMode ? false : isMinimized;
  const toggleMinimize = () => setIsMinimized(!isMinimized);

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'tasks') return ['task_created', 'task_assigned', 'task_status_changed', 'task_completed'].includes(event.type);
    if (filter === 'agents') return ['agent_joined', 'agent_status_changed', 'message_sent'].includes(event.type);
    return true;
  });

  return (
    <aside
      className={`bg-mc-bg-secondary ${mobileMode ? 'border border-mc-border rounded-lg h-full' : 'border-l border-mc-border'} flex flex-col transition-all duration-300 ease-in-out ${
        effectiveMinimized ? 'w-12' : mobileMode ? 'w-full' : 'w-80'
      }`}
    >
      <div className="p-3 border-b border-mc-border">
        <div className="flex items-center">
          {!mobileMode && (
            <button
              onClick={toggleMinimize}
              className="p-1 rounded hover:bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text transition-colors"
              aria-label={effectiveMinimized ? c('expandFeed') : c('minimizeFeed')}
            >
              {effectiveMinimized ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          {!effectiveMinimized && <span className="text-sm font-medium uppercase tracking-wider">{d('liveFeed')}</span>}
        </div>

        {!effectiveMinimized && (
          <div className={`mt-3 ${mobileMode && isPortrait ? 'grid grid-cols-3 gap-2' : 'flex gap-1'}`}>
            {(['all', 'tasks', 'agents'] as FeedFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`min-h-11 text-xs rounded uppercase ${mobileMode && isPortrait ? 'px-1' : 'px-3'} ${
                  filter === tab ? 'bg-mc-accent text-mc-bg font-medium' : 'text-mc-text-secondary hover:bg-mc-bg-tertiary'
                }`}
              >
                {tab === 'all' ? c('all') : tab === 'tasks' ? t('label') : a('title')}
              </button>
            ))}
          </div>
        )}
      </div>

      {!effectiveMinimized && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-mc-text-secondary text-sm">{act('noEvents')}</div>
          ) : (
            filteredEvents.map((event) => <EventItem key={event.id} event={event} />)
          )}
        </div>
      )}
    </aside>
  );
}

/**
 * 单条动态项组件。
 * @param {Object} param - 组件属性。
 */
function EventItem({ event }: { event: Event }) {
  /**
   * 根据动态类型获取图标。
   */
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'task_created':
        return '📋';
      case 'task_assigned':
        return '👤';
      case 'task_status_changed':
        return '🔄';
      case 'task_completed':
        return '✅';
      case 'message_sent':
        return '💬';
      case 'agent_joined':
        return '🎉';
      case 'agent_status_changed':
        return '🔔';
      case 'system':
        return '⚙️';
      default:
        return '📌';
    }
  };

  const isTaskEvent = ['task_created', 'task_assigned', 'task_completed'].includes(event.type);
  const isHighlight = event.type === 'task_created' || event.type === 'task_completed';

  return (
    <div
      className={`p-2 rounded border-l-2 animate-slide-in ${
        isHighlight ? 'bg-mc-bg-tertiary border-mc-accent-pink' : 'bg-transparent border-transparent hover:bg-mc-bg-tertiary'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm">{getEventIcon(event.type)}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${isTaskEvent ? 'text-mc-accent-pink' : 'text-mc-text'}`}>{event.message}</p>
          <div className="flex items-center gap-1 mt-1 text-xs text-mc-text-secondary">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
}
