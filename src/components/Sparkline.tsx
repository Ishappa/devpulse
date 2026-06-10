/**
 * Tiny dependency-free SVG sparkline. We deliberately avoid a charting library here:
 * it would add tens of KB of client JS for a read-only visual, hurting TBT/INP. This
 * renders on the server with zero client JS.
 */
interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ values, width = 120, height = 32, className = '' }: SparklineProps) {
  if (values.length < 2) {
    return <div style={{ width, height }} className={className} aria-hidden />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const rising = values[values.length - 1] >= values[0];
  const stroke = rising ? 'var(--accent-2)' : 'var(--muted)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Momentum trend, ${rising ? 'rising' : 'falling'}`}
    >
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
