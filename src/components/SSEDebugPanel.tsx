'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SSELogEntry {
  timestamp: Date;
  type: string;
  data: unknown;
}

/**
 * 格式化日志数据为易读的字符串。
 * @param {unknown} data - 原始数据对象。
 * @returns {string} 格式化后的 JSON 或字符串。
 */
function formatLogData(data: unknown): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }
  return String(data);
}

/**
 * SSE 调试面板组件。
 * 监听控制台中的特定日志标记（SSE, STORE, API）并显示在浮动面板中，仅在开启调试模式时启用。
 */
export function SSEDebugPanel() {
  const t = useTranslations('Debug');
  const common = useTranslations('Common');
  const act = useTranslations('Activity');
  
  const [logs, setLogs] = useState<SSELogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  /**
   * 添加一条新的调试日志。
   */
  const addLog = useCallback((type: string, data: unknown) => {
    setLogs(prev => [{
      timestamp: new Date(),
      type,
      data
    }, ...prev].slice(0, 50)); // 仅保留最近 50 条
  }, []);

  useEffect(() => {
    // 检查是否开启了调试模式
    const debugEnabled = typeof window !== 'undefined' && localStorage.getItem('MC_DEBUG') === 'true';
    setIsEnabled(debugEnabled);

    if (!debugEnabled) return;

    // 拦截 console.log 以捕获特定事件
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      originalLog.apply(console, args);

      // 捕获 SSE、STORE 和 API 相关日志
      if (typeof args[0] === 'string') {
        const msg = args[0] as string;
        if (msg.includes('[SSE]') || msg.includes('[STORE]') || msg.includes('[API]')) {
          const type = msg.replace(/^\[([^\]]+)\].*$/, '$1');
          const message = msg.replace(/^\[[^\]]+\]\s*/, '');
          addLog(`${type}: ${message}`, args[1]);
        }
      }
    };

    return () => {
      console.log = originalLog;
    };
  }, [addLog]);

  // 监听 storage 变更以实时响应调试模式切换
  useEffect(() => {
    const handleStorage = () => {
      const debugEnabled = localStorage.getItem('MC_DEBUG') === 'true';
      setIsEnabled(debugEnabled);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!isEnabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* 面板开关按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-mc-bg-secondary border border-mc-border rounded-lg shadow-lg text-sm hover:bg-mc-bg-tertiary transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="text-mc-accent font-medium">{t('panel')}</span>
        <span className="bg-mc-accent text-mc-bg px-2 py-0.5 rounded text-[10px] font-bold">
          {logs.length}
        </span>
      </button>

      {/* 展开的日志列表 */}
      {isOpen && (
        <div className="absolute bottom-12 left-0 w-[400px] max-h-[400px] bg-mc-bg-secondary border border-mc-border rounded-lg shadow-2xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-mc-border flex justify-between items-center bg-mc-bg-tertiary/30">
            <span className="text-sm font-semibold">{t('events')}</span>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-mc-text-secondary hover:text-mc-accent transition-colors"
            >
              {common('clear')}
            </button>
          </div>
          
          <div className="overflow-y-auto flex-1 p-2 space-y-1 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="text-mc-text-secondary text-center py-8 italic">
                {act('waitingEvents')}
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="p-2 bg-mc-bg rounded border border-mc-border/50 hover:border-mc-accent/30 transition-colors">
                  <div className="flex justify-between text-mc-text-secondary mb-1">
                    <span className="text-mc-accent font-bold">[{log.type}]</span>
                    <span className="opacity-60">{log.timestamp.toLocaleTimeString()}</span>
                  </div>
                  {log.data !== null && log.data !== undefined && (
                    <pre className="text-mc-text overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                      {formatLogData(log.data)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
