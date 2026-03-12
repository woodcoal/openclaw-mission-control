'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * 演示模式横幅组件。
 * 当应用运行在 Demo 模式时，在页面顶部显示只读提示及源码链接。
 */
export default function DemoBanner() {
  const t = useTranslations('Demo');
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    /**
     * 检查当前实例是否为演示模式。
     */
    fetch('/api/demo')
      .then(r => r.json())
      .then(data => setIsDemo(data.demo))
      .catch(() => {});
  }, []);

  if (!isDemo) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white text-center py-2 px-4 text-sm font-medium z-50 relative shadow-md">
      <span className="mr-2">🎮</span>
      <span>{t('banner')}</span>
      <a
        href="https://github.com/crshdn/mission-control"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-3 underline hover:text-blue-200 transition-colors font-semibold"
      >
        {t('getMC')}
      </a>
    </div>
  );
}
