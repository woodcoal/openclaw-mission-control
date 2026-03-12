import { NextRequest, NextResponse } from 'next/server';

const MC_API_TOKEN = process.env.MC_API_TOKEN;

/**
 * 检查请求是否来自相同源。
 * @param {NextRequest} request - Next.js 请求对象。
 * @returns {boolean} 是否为同源请求。
 */
function isSameOriginRequest(request: NextRequest): boolean {
  const host = request.headers.get('host');
  if (!host) return false;
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (!origin && !referer) return false;
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) return true;
    } catch { }
  }
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) return true;
    } catch { }
  }
  return false;
}

const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * API 安全防护中间件入口。
 * 已移除 i18n 路由逻辑，保持原始路径不变。
 * @param {NextRequest} request - 请求对象。
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (DEMO_MODE) {
      const method = request.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        return NextResponse.json(
          { error: 'Demo mode — read-only instance.' },
          { status: 403 }
        );
      }
    }

    if (pathname.startsWith('/api/webhooks/') || !MC_API_TOKEN || isSameOriginRequest(request)) {
      return NextResponse.next();
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== MC_API_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};
