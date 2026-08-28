import { useState } from 'react';
import { CompetencyScoreDto } from '@ai-interview/contracts';

interface CompetencyRadarChartProps {
  competencies: CompetencyScoreDto[];
  size?: number;
}

export function CompetencyRadarChart({ competencies, size = 340 }: CompetencyRadarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const center = size / 2;
  const radius = size / 2 - 45;
  const count = competencies.length || 5;
  const angleStep = (Math.PI * 2) / count;

  // Levels for concentric polygon grid (2, 4, 6, 8, 10)
  const levels = [2, 4, 6, 8, 10];

  // Helper to calculate coordinates
  const getCoordinates = (index: number, value: number, max: number = 10) => {
    const angle = index * angleStep - Math.PI / 2;
    // Apply min floor radius of 1.5 so zero/low scores never collapse into a dot
    const displayValue = Math.min(max, Math.max(1.4, value));
    const r = (displayValue / max) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Generate data polygon points
  const polygonPoints = competencies
    .map((c, i) => {
      const { x, y } = getCoordinates(i, c.score || 0);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      data-testid="competency-radar-chart"
    >
      <svg
        width={size}
        height={size}
        className="overflow-visible"
        role="img"
        aria-label="Biểu đồ radar đánh giá năng lực ứng viên"
      >
        {/* Background Grid Concentric Web */}
        {levels.map(level => {
          const levelPoints = Array.from({ length: count })
            .map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = (level / 10) * radius;
              const x = center + r * Math.cos(angle);
              const y = center + r * Math.sin(angle);
              return `${x},${y}`;
            })
            .join(' ');

          return (
            <polygon
              key={level}
              points={levelPoints}
              className={`transition-colors stroke-slate-200/90 dark:stroke-slate-700/80 ${
                level === 10 ? 'fill-emerald-50/20 dark:fill-slate-800/40' : 'fill-none'
              }`}
              strokeWidth="1"
              strokeDasharray={level % 4 === 0 ? undefined : '3 3'}
            />
          );
        })}

        {/* Axis Lines radiating from center */}
        {competencies.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth="1"
            />
          );
        })}

        {/* Center Origin Dot */}
        <circle cx={center} cy={center} r={2.5} className="fill-slate-300 dark:fill-slate-600" />

        {/* Data Area Polygon with Glowing Fill */}
        <polygon
          points={polygonPoints}
          fill="url(#radarGradient)"
          stroke="#059669"
          strokeWidth="2.5"
          className="transition-all duration-500 ease-out filter drop-shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
        />

        {/* Gradients */}
        <defs>
          <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Data Points & Interactive Vertices */}
        {competencies.map((c, i) => {
          const { x, y } = getCoordinates(i, c.score || 0);
          const isHovered = hoveredIndex === i;

          return (
            <g key={c.competency}>
              {isHovered && (
                <circle cx={x} cy={y} r={10} className="fill-emerald-400/30 animate-ping" />
              )}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? '#059669' : '#10b981'}
                stroke="#ffffff"
                strokeWidth="2"
                tabIndex={0}
                role="button"
                aria-label={`${c.name || c.competency}: ${c.score} trên 10`}
                className="cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(i)}
                onBlur={() => setHoveredIndex(null)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setHoveredIndex(prev => (prev === i ? null : i));
                  }
                }}
              />
            </g>
          );
        })}

        {/* Axis Label Text & Numeric Score Badges */}
        {competencies.map((c, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelDist = radius + 30;
          const x = center + labelDist * Math.cos(angle);
          const y = center + labelDist * Math.sin(angle);
          const isHovered = hoveredIndex === i;
          const labelName = (c.name || c.competency || '').split(' & ')[0];
          const score = Number(c.score || 0);

          return (
            <g
              key={`label-${c.competency}`}
              tabIndex={0}
              role="button"
              aria-label={`${c.name || c.competency}: ${c.score} trên 10`}
              className="cursor-pointer focus:outline-none"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(i)}
              onBlur={() => setHoveredIndex(null)}
            >
              <text
                x={x}
                y={y - 6}
                textAnchor="middle"
                dominantBaseline="central"
                className={`text-[10.5px] font-bold transition-colors ${
                  isHovered
                    ? 'fill-emerald-700 dark:fill-emerald-400 font-extrabold'
                    : 'fill-slate-700 dark:fill-slate-200'
                }`}
              >
                {labelName}
              </text>
              <text
                x={x}
                y={y + 7}
                textAnchor="middle"
                dominantBaseline="central"
                className={`text-[9.5px] font-mono font-extrabold ${
                  score >= 8.0
                    ? 'fill-emerald-600 dark:fill-emerald-400'
                    : score >= 6.0
                      ? 'fill-teal-600 dark:fill-teal-400'
                      : 'fill-amber-600 dark:fill-amber-400'
                }`}
              >
                {score.toFixed(1)}/10
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover / Focus Info Tooltip */}
      {hoveredIndex !== null && competencies[hoveredIndex] && (
        <div
          role="tooltip"
          className="absolute bottom-1 bg-slate-900/95 dark:bg-slate-800 text-slate-100 text-xs px-3.5 py-2 rounded-xl shadow-xl border border-slate-700 dark:border-slate-600 flex items-center gap-2.5 animate-fade-in pointer-events-none z-10 backdrop-blur-md"
        >
          <span className="font-bold text-white">
            {competencies[hoveredIndex].name || competencies[hoveredIndex].competency}:
          </span>
          <span className="text-emerald-400 dark:text-emerald-300 font-extrabold font-mono text-sm">
            {competencies[hoveredIndex].score.toFixed(1)} / 10
          </span>
          <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
            {competencies[hoveredIndex].benchmarkLevel}
          </span>
        </div>
      )}
    </div>
  );
}
