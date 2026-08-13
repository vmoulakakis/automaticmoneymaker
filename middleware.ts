import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const user = process.env.ADMIN_DASHBOARD_USER;
  const password = process.env.ADMIN_DASHBOARD_PASSWORD;

  if (!user || !password) {
    if (process.env.NODE_ENV === 'development') return NextResponse.next();
    return new NextResponse('Dashboard credentials are not configured.', { status: 503 });
  }

  const header = request.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const splitAt = decoded.indexOf(':');
      const suppliedUser = decoded.slice(0, splitAt);
      const suppliedPassword = decoded.slice(splitAt + 1);
      if (suppliedUser === user && suppliedPassword === password) return NextResponse.next();
    } catch {}
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="EU Stock Intelligence"' },
  });
}

export const config = {
  matcher: ['/', '/config/:path*'],
};
