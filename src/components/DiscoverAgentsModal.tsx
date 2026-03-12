'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Download, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { DiscoveredAgent } from '@/lib/types';
import { useTranslations } from 'next-intl';

interface DiscoverAgentsModalProps {
  onClose: () => void;
  workspaceId?: string;
}

/**
 * 发现并导入 Gateway 助手的模态框。
 * 从 OpenClaw Gateway 获取现有助手列表，并允许用户将其导入到当前工作区。
 */
export function DiscoverAgentsModal({ onClose, workspaceId }: DiscoverAgentsModalProps) {
  const t = useTranslations('Agents');
  const common = useTranslations('Common');
  
  const { addAgent } = useMissionControl();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<DiscoveredAgent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  /**
   * 从 Gateway 获取可用助手列表。
   */
  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      const res = await fetch('/api/agents/discover');
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Failed to discover agents (${res.status})`);
        return;
      }
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {
      setError('Failed to connect to the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    discover();
  }, [discover]);

  /**
   * 切换助手的选中状态。
   */
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /**
   * 选中所有尚未导入的助手。
   */
  const selectAllAvailable = () => {
    const available = agents.filter((a) => !a.already_imported).map((a) => a.id);
    setSelectedIds(new Set(available));
  };

  /**
   * 取消所有选中。
   */
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  /**
   * 执行导入操作。
   */
  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    setImporting(true);
    setError(null);

    try {
      const agentsToImport = agents
        .filter((a) => selectedIds.has(a.id))
        .map((a) => ({
          gateway_agent_id: a.id,
          name: a.name,
          model: a.model,
          workspace_id: workspaceId || 'default',
        }));

      const res = await fetch('/api/agents/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: agentsToImport }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to import agents');
        return;
      }

      const data = await res.json();

      // 将成功导入的助手添加到本地状态库
      for (const agent of data.imported) {
        addAgent(agent);
      }

      setImportResult({
        imported: data.imported.length,
        skipped: data.skipped.length,
      });

      // 刷新发现列表
      await discover();
      setSelectedIds(new Set());
    } catch (err) {
      setError('Failed to import agents');
    } finally {
      setImporting(false);
    }
  };

  const availableCount = agents.filter((a) => !a.already_imported).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-t-xl sm:rounded-lg w-full max-w-2xl max-h-[88vh] sm:max-h-[80vh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-mc-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-mc-accent" />
              {t('discoverTitle')}
            </h2>
            <p className="text-sm text-mc-text-secondary mt-1">
              {t('discoverHint')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-mc-bg-tertiary rounded shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-mc-accent mr-3" />
              <span className="text-mc-text-secondary">{t('discovering')}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {importResult && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg mb-4">
              <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-400">
                {importResult.imported} {importResult.imported === 1 ? common('active') : common('active')} {t('alreadyImported')}
                {importResult.skipped > 0 && ` (${importResult.skipped} skipped)`}
              </span>
            </div>
          )}

          {!loading && !error && agents.length === 0 && (
            <div className="text-center py-12 text-mc-text-secondary">
              <p>{t('noAgentsFound')}</p>
              <p className="text-sm mt-2">{t('noAgentsHint')}</p>
            </div>
          )}

          {!loading && agents.length > 0 && (
            <>
              {/* 统计与批量操作 */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-sm text-mc-text-secondary font-medium">
                  {t('foundCount', { count: agents.length })}
                  {availableCount < agents.length && ` · ${agents.length - availableCount} ${t('alreadyImported')}`}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={discover}
                    className="min-h-11 flex items-center gap-1.5 px-3 py-2 text-xs text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary rounded transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {common('refresh')}
                  </button>
                  {availableCount > 0 && (
                    <>
                      <button
                        onClick={selectAllAvailable}
                        className="min-h-11 px-3 py-2 text-xs text-mc-accent hover:bg-mc-accent/10 rounded transition-colors"
                      >
                        {common('selectAll')}
                      </button>
                      <button
                        onClick={deselectAll}
                        className="min-h-11 px-3 py-2 text-xs text-mc-text-secondary hover:bg-mc-bg-tertiary rounded transition-colors"
                      >
                        {common('deselectAll')}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 助手列表 */}
              <div className="space-y-2">
                {agents.map((agent) => {
                  const isSelected = selectedIds.has(agent.id);
                  const isImported = agent.already_imported;

                  return (
                    <div
                      key={agent.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all min-h-11 ${
                        isImported
                          ? 'border-mc-border/50 bg-mc-bg/50 opacity-60'
                          : isSelected
                          ? 'border-mc-accent/50 bg-mc-accent/5'
                          : 'border-mc-border hover:border-mc-border/80 hover:bg-mc-bg-tertiary cursor-pointer'
                      }`}
                      onClick={() => !isImported && toggleSelection(agent.id)}
                    >
                      {/* 复选框 */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isImported
                            ? 'border-green-500/50 bg-green-500/20'
                            : isSelected
                            ? 'border-mc-accent bg-mc-accent'
                            : 'border-mc-border'
                        }`}
                      >
                        {(isSelected || isImported) && (
                          <Check className={`w-3 h-3 ${isImported ? 'text-green-400' : 'text-mc-bg'}`} />
                        )}
                      </div>

                      {/* 助手头像 */}
                      <span className="text-2xl">{isImported ? '🔗' : '🤖'}</span>

                      {/* 助手信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{agent.name}</span>
                          {isImported && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded uppercase font-bold">
                              {t('alreadyImported')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mc-text-secondary mt-1">
                          {agent.model && <span>{t('modelLabel')}{agent.model}</span>}
                          {agent.channel && <span>{t('channelLabel')}{agent.channel}</span>}
                          {agent.status && <span>{t('statusLabel')}{agent.status}</span>}
                          <span className="opacity-60">{t('idLabel')}{agent.id}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between p-4 border-t border-mc-border flex-shrink-0">
          <span className="text-sm text-mc-text-secondary font-medium">
            {selectedIds.size > 0 ? `${selectedIds.size} ${common('active')}` : t('selectToImport')}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onClose}
              className="min-h-11 px-4 py-2 text-sm text-mc-text-secondary hover:text-mc-text transition-colors"
            >
              {importResult ? common('done') : common('cancel')}
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importing}
              className="min-h-11 flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {common('loading')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {common('working')} {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
