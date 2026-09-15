export function CalorieRing({ consumed, target }: { consumed: number; target: number | null }) {
  const size = 148;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target ? Math.min(consumed / target, 1) : 0;
  const over = target ? consumed > target : false;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2ddd0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? "#a8443d" : "#c9973d"}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="font-display text-3xl font-semibold text-ink">{Math.round(consumed)}</p>
        <p className="text-sm text-ink-soft">
          {target ? `of ${Math.round(target)} kcal target` : "no calorie target set yet"}
        </p>
      </div>
    </div>
  );
}
