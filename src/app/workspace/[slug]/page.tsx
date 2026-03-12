'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ListTodo, Users, Activity, Settings as SettingsIcon, ExternalLink, Home, BarChart3, Edit3 } from 'lucide-react';
import { Header } from '@/components/Header';
import { AgentsSidebar } from '@/components/AgentsSidebar';
import { MissionQueue } from '@/components/MissionQueue';
import { LiveFeed } from '@/components/LiveFeed';
import { SSEDebugPanel } from '@/components/SSEDebugPanel';
import { WorkspaceModal } from '@/components/WorkspaceModal';
import { useMissionControl } from '@/lib/store';
import { useSSE } from '@/hooks/useSSE';
import { debug } from '@/lib/debug';
import type { Task, Workspace } from '@/lib/types';
import { useTranslations } from 'next-intl';

type MobileTab = 'queue' | 'agents' | 'feed' | 'settings';

/**
 * 工作区详情页面组件。
 * 根据 URL 中的 slug 加载并显示工作区的任务看板、助手和动态。
 */
export default function WorkspacePage() {
  const t = useTranslations('Workspace');
  const c = useTranslations('Common');
  
  const params = useParams();
  const slug = params.slug as string;

  const { setAgents, setTasks, setEvents, setIsOnline, setIsLoading, isLoading } = useMissionControl();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('queue');
  const [isPortrait, setIsPortrait] = useState(true);

  useSSE();

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)');
    const updateOrientation = () => setIsPortrait(media.matches);

    updateOrientation();
    media.addEventListener('change', updateOrientation);
    window.addEventListener('resize', updateOrientation);

    return () => {
      media.removeEventListener('change', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
    };
  }, []);

  useEffect(() => {
    /**
     * 根据 slug 获取工作区基础信息。
     */
    async function loadWorkspace() {
      try {
        const res = await fetch(`/api/workspaces/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setWorkspace(data);
        } else if (res.status === 404) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Failed to load workspace:', error);
        setNotFound(true);
        setIsLoading(false);
        return;
      }
    }

    loadWorkspace();
  }, [slug, setIsLoading]);

  useEffect(() => {
    if (!isPortrait && mobileTab === 'queue') {
      setMobileTab('agents');
    }
  }, [isPortrait, mobileTab]);

  useEffect(() => {
    if (!workspace) return;

    const workspaceId = workspace.id;

    /**
     * 加载工作区内的助手、任务和全局动态。
     */
    async function loadData() {
      try {
        debug.api('Loading workspace data...', { workspaceId });

        const [agentsRes, tasksRes, eventsRes] = await Promise.all([
          fetch(`/api/agents?workspace_id=${workspaceId}`),
          fetch(`/api/tasks?workspace_id=${workspaceId}`),
          fetch('/api/events'),
        ]);

        if (agentsRes.ok) setAgents(await agentsRes.json());
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          debug.api('Loaded tasks', { count: tasksData.length });
          setTasks(tasksData);
        }
        if (eventsRes.ok) setEvents(await eventsRes.json());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    /**
     * 检查 OpenClaw Gateway 的连接状态。
     */
    async function checkOpenClaw() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const openclawRes = await fetch('/api/openclaw/status', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (openclawRes.ok) {
          const status = await openclawRes.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }

    loadData();
    checkOpenClaw();

    // 轮询：动态更新
    const eventPoll = setInterval(async () => {
      try {
        const res = await fetch('/api/events?limit=20');
        if (res.ok) {
          setEvents(await res.json());
        }
      } catch (error) {
        console.error('Failed to poll events:', error);
      }
    }, 30000);

    // 轮询：任务更新（作为 SSE 的兜底）
    const taskPoll = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks?workspace_id=${workspaceId}`);
        if (res.ok) {
          const newTasks: Task[] = await res.json();
          const currentTasks = useMissionControl.getState().tasks;

          const hasChanges =
            newTasks.length !== currentTasks.length ||
            newTasks.some((t) => {
              const current = currentTasks.find((ct) => ct.id === t.id);
              return !current || current.updated_at !== t.updated_at;
            });

          if (hasChanges) {
            debug.api('[FALLBACK] Task changes detected via polling, updating store');
            setTasks(newTasks);
          }
        }
      } catch (error) {
        console.error('Failed to poll tasks:', error);
      }
    }, 60000);

    // 轮询：OpenClaw 状态
    const connectionCheck = setInterval(async () => {
      try {
        const res = await fetch('/api/openclaw/status');
        if (res.ok) {
          const status = await res.json();
          setIsOnline(status.connected);
        }
      } catch {
        setIsOnline(false);
      }
    }, 30000);

    return () => {
      clearInterval(eventPoll);
      clearInterval(connectionCheck);
      clearInterval(taskPoll);
    };
  }, [workspace, setAgents, setTasks, setEvents, setIsOnline, setIsLoading]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">{t('notFound')}</h1>
          <p className="text-mc-text-secondary mb-6">{t('notFoundDesc', { slug })}</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90">
            <ChevronLeft className="w-4 h-4" />
            {t('backToDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !workspace) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦞</div>
          <p className="text-mc-text-secondary">{t('loadingWorkspace', { slug })}</p>
        </div>
      </div>
    );
  }

  const showMobileBottomTabs = isPortrait;

  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <Header workspace={workspace} isPortrait={isPortrait} />

      <div className="hidden lg:flex flex-1 overflow-hidden">
        <AgentsSidebar workspaceId={workspace.id} />
        <MissionQueue workspaceId={workspace.id} />
        <LiveFeed />
      </div>

      <div
        className={`lg:hidden flex-1 overflow-hidden ${
          showMobileBottomTabs ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]' : 'pb-[env(safe-area-inset-bottom)]'
        }`}
      >
        {isPortrait ? (
          <>
            {mobileTab === 'queue' && <MissionQueue workspaceId={workspace.id} mobileMode isPortrait />}
            {mobileTab === 'agents' && (
              <div className="h-full p-3 overflow-y-auto">
                <AgentsSidebar workspaceId={workspace.id} mobileMode isPortrait />
              </div>
            )}
            {mobileTab === 'feed' && (
              <div className="h-full p-3 overflow-y-auto">
                <LiveFeed mobileMode isPortrait />
              </div>
            )}
            {mobileTab === 'settings' && <MobileSettingsPanel workspace={workspace} />}
          </>
        ) : (
          <div className="h-full p-3 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
            <MissionQueue workspaceId={workspace.id} mobileMode isPortrait={false} />
            <div className="min-w-0 h-full flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setMobileTab('agents')}
                  className={`min-h-11 rounded-lg text-xs ${mobileTab === 'agents' ? 'bg-mc-accent text-mc-bg font-medium' : 'bg-mc-bg-secondary border border-mc-border text-mc-text-secondary'}`}
                >
                  {c('all')}
                </button>
                <button
                  onClick={() => setMobileTab('feed')}
                  className={`min-h-11 rounded-lg text-xs ${mobileTab === 'feed' ? 'bg-mc-accent text-mc-bg font-medium' : 'bg-mc-bg-secondary border border-mc-border text-mc-text-secondary'}`}
                >
                  {c('feed')}
                </button>
                <button
                  onClick={() => setMobileTab('settings')}
                  className={`min-h-11 rounded-lg text-xs ${mobileTab === 'settings' ? 'bg-mc-accent text-mc-bg font-medium' : 'bg-mc-bg-secondary border border-mc-border text-mc-text-secondary'}`}
                >
                  {c('settings')}
                </button>
              </div>

              <div className="min-h-0 flex-1">
                {mobileTab === 'settings' ? (
                  <MobileSettingsPanel workspace={workspace} denseLandscape />
                ) : mobileTab === 'agents' ? (
                  <AgentsSidebar workspaceId={workspace.id} mobileMode isPortrait={false} />
                ) : (
                  <LiveFeed mobileMode isPortrait={false} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showMobileBottomTabs && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-mc-border bg-mc-bg-secondary pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4 gap-1 p-2">
            <MobileTabButton label="Queue" active={mobileTab === 'queue'} icon={<ListTodo className="w-5 h-5" />} onClick={() => setMobileTab('queue')} />
            <MobileTabButton label="Agents" active={mobileTab === 'agents'} icon={<Users className="w-5 h-5" />} onClick={() => setMobileTab('agents')} />
            <MobileTabButton label="Feed" active={mobileTab === 'feed'} icon={<Activity className="w-5 h-5" />} onClick={() => setMobileTab('feed')} />
            <MobileTabButton label="Settings" active={mobileTab === 'settings'} icon={<SettingsIcon className="w-5 h-5" />} onClick={() => setMobileTab('settings')} />
          </div>
        </nav>
      )}

      <SSEDebugPanel />
    </div>
  );
}

/**
 * 移动端底部标签页按钮。
 * @param {Object} param - 组件属性。
 */
function MobileTabButton({ label, active, icon, onClick }: { label: string; active: boolean; icon: ReactNode; onClick: () => void }) {
  const d = useTranslations('Dashboard');
  const c = useTranslations('Common');
  
  // 映射 label 到翻译
  const translatedLabel = label === 'Queue' ? d('missionQueue') : label === 'Agents' ? d('agents') : label === 'Feed' ? d('liveFeed') : c('settings');

  return (
    <button
      onClick={onClick}
      className={`min-h-11 rounded-lg flex flex-col items-center justify-center text-xs ${
        active ? 'bg-mc-accent text-mc-bg font-medium' : 'text-mc-text-secondary'
      }`}
    >
      {icon}
      <span>{translatedLabel}</span>
    </button>
  );
}

/**
 * 移动端设置面板。
 * 提供当前工作区信息及快捷导航链接。
 * @param {Object} param - 组件属性。
 */
function MobileSettingsPanel({ workspace, denseLandscape = false }: { workspace: Workspace; denseLandscape?: boolean }) {
  const t = useTranslations('Workspace');
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  return (
    <div className={`h-full overflow-y-auto ${denseLandscape ? 'p-0 pb-[env(safe-area-inset-bottom)]' : 'p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]'}`}>
      <div className="space-y-3">
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4">
          <div className="text-sm text-mc-text-secondary mb-2">{t('currentWorkspace')}</div>
          <div className="flex items-center gap-2 text-base font-medium">
            <span>{workspace.icon}</span>
            <span>{workspace.name}</span>
          </div>
          <div className="text-xs text-mc-text-secondary mt-1">/{workspace.slug}</div>
        </div>


        <Link href={`/workspace/${workspace.slug}/activity`} className="w-full min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg-secondary flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('activityDashboard')}
          </span>
          <ExternalLink className="w-4 h-4 text-mc-text-secondary" />
        </Link>
        
        <button 
          onClick={() => setIsEditing(true)}
          className="w-full min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg-secondary flex items-center justify-between text-sm"
        >
          <span className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            {t('editWorkspace')}
          </span>
          <Edit3 className="w-4 h-4 text-mc-text-secondary" />
        </button>

        <Link href="/settings" className="w-full min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg-secondary flex items-center justify-between text-sm opacity-50">
          <span className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            {t('openSettings')}
          </span>
          <ExternalLink className="w-4 h-4 text-mc-text-secondary" />
        </Link>

        <Link href="/" className="w-full min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg-secondary flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            {t('backToWorkspaces')}
          </span>
          <ExternalLink className="w-4 h-4 text-mc-text-secondary" />
        </Link>
      </div>

      {isEditing && (
        <WorkspaceModal
          workspace={workspace}
          onClose={() => setIsEditing(false)}
          onSuccess={() => {
            setIsEditing(false);
            window.location.reload(); // Hard reload for mobile if slug changed
          }}
        />
      )}
    </div>
  );
}
