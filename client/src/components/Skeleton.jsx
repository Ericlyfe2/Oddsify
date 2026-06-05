/**
 * Reusable shimmer loader. Pass dimensions via style or use a preset.
 *   <Skeleton width="60%" height={16} />
 *   <Skeleton.Line lines={3} />
 *   <Skeleton.Card />
 */
export default function Skeleton({ width = '100%', height = 14, radius = 8, style, className = '' }) {
  return (
    <span
      className={`skl ${className}`}
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

Skeleton.Line = function SkeletonLine({ lines = 3, lastWidth = '60%', gap = 10 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? lastWidth : '100%'} height={12} />
      ))}
    </div>
  );
};

Skeleton.Card = function SkeletonCard({ aspect = '1.4 / 1' }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      aria-hidden="true"
    >
      <Skeleton width="100%" style={{ aspectRatio: aspect, height: 'auto' }} radius={10} />
      <Skeleton width="70%" height={14} />
      <Skeleton width="40%" height={11} />
      <Skeleton width="100%" height={32} radius={10} />
    </div>
  );
};

Skeleton.Row = function SkeletonRow() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px dashed var(--line)',
      }}
      aria-hidden="true"
    >
      <div>
        <Skeleton width="40%" height={12} />
        <Skeleton width="25%" height={10} style={{ marginTop: 6 }} />
      </div>
      <Skeleton width={80} height={14} />
    </div>
  );
};
