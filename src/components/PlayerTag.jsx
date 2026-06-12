export default function PlayerTag({ drawnBy, compact = false }) {
  if (!drawnBy) return compact ? null : <span className="tag tag-none">—</span>;
  return (
    <span
      className={compact ? 'tag compact' : 'tag'}
      style={{ '--player': drawnBy.colour }}
      title={`Drawn by ${drawnBy.name}`}
    >
      <i />
      {compact ? null : drawnBy.name}
    </span>
  );
}
