/**
 * Settings Page
 * Configure Mission Control paths, URLs, and preferences
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, RotateCcw, FolderOpen, Link as LinkIcon, Globe } from 'lucide-react';
import { getConfig, updateConfig, resetConfig, type MissionControlConfig } from '@/lib/config';
import { useMissionControl } from '@/lib/store';
import { useTranslations } from 'next-intl';

/**
 * 设置页面组件。
 * 提供路径配置、API 设置及语言切换功能。
 * @returns {JSX.Element} 渲染的设置页面。
 */
export default function SettingsPage() {
  const router = useRouter();
  const h = useTranslations('Header');
  const common = useTranslations('Common');
  const t = useTranslations('Settings');
  
  const { locale, setLocale } = useMissionControl();
  const [config, setConfig] = useState<MissionControlConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(getConfig());
  }, []);

  /**
   * 保存当前配置到本地存储。
   */
  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      updateConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 将所有配置重置为默认值。
   */
  const handleReset = () => {
    if (confirm(t('resetConfirm'))) {
      resetConfig();
      setConfig(getConfig());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  /**
   * 处理配置项变更。
   * @param {K} field - 配置字段名。
   * @param {MissionControlConfig[K]} value - 新的配置值。
   */
  const handleChange = <K extends keyof MissionControlConfig>(field: K, value: MissionControlConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-mc-text-secondary">{common('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mc-bg pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary"
              title={common('back')}
            >
              ←
            </button>
            <Settings className="w-6 h-6 text-mc-accent" />
            <h1 className="text-2xl font-bold text-mc-text">{h('settings')}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-mc-border rounded hover:bg-mc-bg-tertiary text-mc-text-secondary flex items-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              {common('reset')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-mc-accent text-mc-bg rounded hover:bg-mc-accent/90 flex items-center gap-2 disabled:opacity-50 text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {isSaving ? common('saving') : common('save')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
            ✓ {t('saveSuccess')}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            ✗ {error}
          </div>
        )}

        {/* Language Selection */}
        <section className="mb-8 p-6 bg-mc-bg-secondary border border-mc-border rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-mc-accent" />
            <h2 className="text-xl font-semibold text-mc-text">{t('language')}</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">
                {t('interfaceLanguage')}
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              >
                <option value="en">English (US)</option>
                <option value="zh">简体中文 (Chinese)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Workspace Paths */}
        <section className="mb-8 p-6 bg-mc-bg-secondary border border-mc-border rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-mc-accent" />
            <div>
              <h2 className="text-xl font-semibold text-mc-text">{t('workspacePaths')}</h2>
              <p className="text-xs text-mc-text-secondary mt-0.5">{t('workspacePathsDesc')}</p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-mc-text mb-1.5">
                {t('workspaceBasePath')}
              </label>
              <input
                type="text"
                value={config.workspaceBasePath}
                onChange={(e) => handleChange('workspaceBasePath', e.target.value)}
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
              <p className="text-[11px] text-mc-text-secondary mt-1.5 leading-relaxed">
                {t('workspaceBasePathDesc')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-mc-text mb-1.5">
                {t('projectsPath')}
              </label>
              <input
                type="text"
                value={config.projectsPath}
                onChange={(e) => handleChange('projectsPath', e.target.value)}
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
              <p className="text-[11px] text-mc-text-secondary mt-1.5 leading-relaxed">
                {t('projectsPathDesc')}
              </p>
            </div>
          </div>
        </section>

        {/* API Configuration */}
        <section className="mb-8 p-6 bg-mc-bg-secondary border border-mc-border rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-mc-accent" />
            <div>
              <h2 className="text-xl font-semibold text-mc-text">{t('apiConfig')}</h2>
              <p className="text-xs text-mc-text-secondary mt-0.5">{t('apiConfigDesc')}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-mc-text mb-1.5">
                {t('mcUrl')}
              </label>
              <input
                type="text"
                value={config.missionControlUrl}
                onChange={(e) => handleChange('missionControlUrl', e.target.value)}
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
              <p className="text-[11px] text-mc-text-secondary mt-1.5">
                {t('mcUrlDesc')}
              </p>
            </div>
          </div>
        </section>

        {/* Environment Variables Note */}
        <section className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-400 mb-2 uppercase tracking-wider">{t('envNote')}</h3>
          <p className="text-xs text-mc-text-secondary leading-relaxed mb-3">
            {t('envNoteDesc')}
          </p>
          <ul className="text-xs text-mc-text-secondary list-disc pl-5 space-y-1.5 mb-3">
            <li><code className="bg-mc-bg px-1 rounded text-blue-300">MC_WORKSPACE_BASE_PATH</code></li>
            <li><code className="bg-mc-bg px-1 rounded text-blue-300">MC_PROJECTS_PATH</code></li>
            <li><code className="bg-mc-bg px-1 rounded text-blue-300">MC_API_TOKEN</code></li>
          </ul>
          <p className="text-[11px] text-blue-400 font-medium italic">
            {t('envPriority')}
          </p>
        </section>
      </div>
    </div>
  );
}
