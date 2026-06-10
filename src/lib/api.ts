/**
 * Consistent JSON response envelope for Route Handlers.
 * Every error has a stable `error` code so the client can branch reliably.
 */
import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'INTERNAL';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(
  status: number,
  error: ApiErrorCode,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error, ...extra }, { status });
}

export function validationError(err: ZodError): NextResponse {
  return fail(400, 'VALIDATION', {
    issues: err.issues.map((i) => ({ path: i.path.join('.'), msg: i.message })),
  });
}

export function rateLimited(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'RATE_LIMIT' as ApiErrorCode, retryAfter: retryAfterSeconds },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}
