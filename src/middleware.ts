/**
 * Edge middleware — security headers + nonce-based Content-Security-Policy.
 *
 * A per-request nonce is generated and threaded to Next via the `x-nonce` request
 * header; Next stamps it onto its own scripts so we can run a strict `script-src`
 * without `unsafe-inline` (XSS defense in depth). In development we relax the policy so
 * HMR / React Refresh keep working.
 *
 * Note: auth gating is enforced server-side in handlers/pages (where the DB-backed
 * session lives), not here — the edge runtime can't run the DB-backed auth callbacks.
 */
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-inline' 'unsafe-eval'`;

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`, // Next/Tailwind inject some inline styles
    `img-src 'self' https://avatars.githubusercontent.com data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    isProd ? `upgrade-insecure-requests` : '',
  ]
    .filter(Boolean)
    .join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProd) {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return res;
}

export const config = {
  // Run on all routes except static assets and image optimization.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
