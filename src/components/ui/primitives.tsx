/** Design-system primitives — server-component-safe (no client hooks). */
import { type ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-bg-card p-4 ${className}`}>{children}</div>
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'muted';
}) {
  const tones: Record<string, string> = {
    default: 'bg-bg-soft text-text border-border',
    accent: 'bg-accent/15 text-accent border-accent/30',
    success: 'bg-accent-2/15 text-accent-2 border-accent-2/30',
    muted: 'bg-bg-soft text-muted border-border',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Skeleton dimensions should match the final content to avoid layout shift (CLS). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-bg-soft ${className}`} aria-hidden />;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg-soft/40 py-16 text-center">
      <p className="text-lg font-medium text-text">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 py-16 text-center"
    >
      <p className="text-lg font-medium text-red-400">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  );
}
