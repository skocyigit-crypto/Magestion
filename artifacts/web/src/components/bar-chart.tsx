// Barres SVG legeres (pas de dependance de charting) — categorical fixe,
// axe unique, libelles directs selectifs, tooltip natif via <title>.
// Palette categorical (ordre fixe, jamais recycle) : bleu/aqua/jaune/vert/violet/rouge.
export const CHART_COLORS = ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181", "#d95926"];

interface Series {
  label: string;
  color: string;
  values: number[];
}

interface GroupedBarChartProps {
  categories: string[];
  series: Series[];
  formatValue?: (n: number) => string;
  height?: number;
}

// Barres groupees (2 series max recommande — plus devient illisible sans
// petits multiples). Un seul axe Y (memes unites pour toutes les series).
export function GroupedBarChart({ categories, series, formatValue = (n) => n.toLocaleString("fr-FR"), height = 220 }: GroupedBarChartProps) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const width = 600;
  const paddingLeft = 8;
  const paddingBottom = 24;
  const plotHeight = height - paddingBottom;
  const groupWidth = (width - paddingLeft) / categories.length;
  const barWidth = Math.max(4, (groupWidth - 8) / series.length - 2);

  return (
    <div className="flex flex-col gap-2">
      {series.length > 1 && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Graphique en barres">
        <line x1={paddingLeft} y1={plotHeight} x2={width} y2={plotHeight} stroke="#334155" strokeWidth={1} />
        {categories.map((cat, i) => {
          const groupX = paddingLeft + i * groupWidth;
          return (
            <g key={cat}>
              {series.map((s, si) => {
                const value = s.values[i] ?? 0;
                const barHeight = max > 0 ? (value / max) * (plotHeight - 12) : 0;
                const x = groupX + 4 + si * (barWidth + 2);
                const y = plotHeight - barHeight;
                return (
                  <rect key={s.label} x={x} y={y} width={barWidth} height={barHeight} rx={3} fill={s.color}>
                    <title>{`${s.label} — ${cat} : ${formatValue(value)}`}</title>
                  </rect>
                );
              })}
              <text x={groupX + groupWidth / 2 - 4} y={plotHeight + 16} fontSize={10} fill="#94a3b8" textAnchor="middle">
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface SingleBarChartProps {
  data: { label: string; value: number; color: string }[];
  formatValue?: (n: number) => string;
  height?: number;
}

// Barres horizontales (une seule serie, rangees deja triees par l'appelant) —
// pratique pour des categories avec des libelles longs (ex: categories de depense).
export function HorizontalBarChart({ data, formatValue = (n) => n.toLocaleString("fr-FR"), height }: SingleBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const rowHeight = 28;
  const chartHeight = height ?? data.length * rowHeight + 8;
  const width = 600;
  const labelWidth = 140;

  return (
    <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full" role="img" aria-label="Graphique en barres horizontales">
      {data.map((d, i) => {
        const barMaxWidth = width - labelWidth - 60;
        const barWidth = max > 0 ? (d.value / max) * barMaxWidth : 0;
        const y = i * rowHeight;
        return (
          <g key={d.label}>
            <text x={labelWidth - 8} y={y + rowHeight / 2 + 4} fontSize={11} fill="#c3c2b7" textAnchor="end">
              {d.label}
            </text>
            <rect x={labelWidth} y={y + 4} width={Math.max(2, barWidth)} height={rowHeight - 10} rx={3} fill={d.color}>
              <title>{`${d.label} : ${formatValue(d.value)}`}</title>
            </rect>
            <text x={labelWidth + barWidth + 6} y={y + rowHeight / 2 + 4} fontSize={11} fill="#94a3b8">
              {formatValue(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
