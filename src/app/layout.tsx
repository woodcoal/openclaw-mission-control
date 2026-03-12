'use client';

import { useEffect } from 'react';
import { Inter } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { useMissionControl } from '@/lib/store';
import en from '../messages/en.json';
import zh from '../messages/zh.json';

const inter = Inter({ subsets: ["latin"] });

const messages: Record<string, any> = { en, zh };

/**
 * 根布局组件。
 * 修复水合逻辑：
 * 1. 初始渲染使用默认 locale ('en') 匹配服务器。
 * 2. 挂载后从 localStorage 恢复用户语言。
 * @param {Object} param - 组件属性。
 * @returns {JSX.Element} 页面渲染结果。
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, setLocale } = useMissionControl();
  
  // 客户端挂载后初始化语言
  useEffect(() => {
    const savedLocale = localStorage.getItem('mc-locale');
    if (savedLocale && savedLocale !== 'en') {
      setLocale(savedLocale);
    }
  }, [setLocale]);

  const currentMessages = messages[locale] || en;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <title>Autensa | Mission Control</title>
        <meta name="description" content="AI Agent Orchestration Dashboard" />
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={currentMessages} timeZone="UTC">
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
