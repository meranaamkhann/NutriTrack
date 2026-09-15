export function MacroBar({
  label,
  grams,
  targetGrams,
  colorClass
}: {
  label: string;
  grams: number;
  targetGrams?: number;
  colorClass: string;
}) {
  const pct = targetGrams ? Math.min((grams / targetGrams) * 100, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-ink-soft">
          {Math.round(grams)}g{targetGrams ? ` / ${Math.round(targetGrams)}g` : ""}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
