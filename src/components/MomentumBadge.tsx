/** Momentum score chip — color-banded into adopt/trial/assess tiers. */
export function MomentumBadge({ score }: { score: number }) {
  const tier =
    score >= 70
      ? { label: 'hot', cls: 'border-accent-2/40 bg-accent-2/10 text-accent-2' }
      : score >= 40
        ? { label: 'rising', cls: 'border-accent/40 bg-accent/10 text-accent' }
        : { label: 'steady', cls: 'border-border bg-bg-soft text-muted' };

  return (
    <div className={`flex w-16 shrink-0 flex-col items-center rounded-lg border px-2 py-1 ${tier.cls}`}>
      <span className="font-mono text-base font-semibold leading-none">{score.toFixed(1)}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide">{tier.label}</span>
    </div>
  );
}
