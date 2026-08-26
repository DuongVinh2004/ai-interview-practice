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
    const r = (value / max) * radius;
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
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Grid Rings */}
        {levels.map(level => {
          const levelPoints = Array.from({ length: count })
            .map((_, i) => {
              const { x, y } = getCoordinates(i, level);
              return `${x},${y}`;
            })
            .join(' ');

          return (
            <polygon
              key={level}
              points={levelPoints}
              fill={level === 10 ? 'rgba(241, 245, 249, 0.6)' : 'none'}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray={level % 4 === 0 ? undefined : '2 2'}
            />
          );
        })}

        {/* Axis Lines radiating from center */}
        {competencies.map((_, i) => {
          const { x, y } = getCoordinates(i, 10);
          return (
            <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#cbd5e1" strokeWidth="1" />
          );
        })}

        {/* Data Area Polygon */}
        <polygon
          points={polygonPoints}
          fill="url(#radarGradient)"
          stroke="#10b981"
          strokeWidth="2.5"
          className="transition-all duration-500 ease-out"
        />

        {/* Gradients */}
        <defs>
          <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Data Points & Interactive Vertices */}
        {competencies.map((c, i) => {
          const { x, y } = getCoordinates(i, c.score || 0);
          const isHovered = hoveredIndex === i;

          return (
            <g key={c.competency}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 7 : 4.5}
                fill={isHovered ? '#059669' : '#10b981'}
                stroke="#ffffff"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          );
        })}

        {/* Axis Label Text */}
        {competencies.map((c, i) => {
          const { x, y } = getCoordinates(i, 11.6);
          const isHovered = hoveredIndex === i;

          return (
            <text
              key={`label-${c.competency}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={`text-[10.5px] font-semibold transition-colors cursor-pointer ${
                isHovered ? 'fill-emerald-600 font-bold' : 'fill-slate-600'
              }`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {(c.name || c.competency || '').split(' & ')[0]}
            </text>
          );
        })}
      </svg>

      {/* Hover Info Tooltip */}
      {hoveredIndex !== null && competencies[hoveredIndex] && (
        <div className="absolute bottom-1 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2 animate-fade-in pointer-events-none">
          <span className="font-semibold">
            {competencies[hoveredIndex].name || competencies[hoveredIndex].competency}:
          </span>
          <span className="text-emerald-400 font-bold font-mono">
            {competencies[hoveredIndex].score.toFixed(1)} / 10
          </span>
          <span className="text-slate-400">({competencies[hoveredIndex].benchmarkLevel})</span>
        </div>
      )}
    </div>
  );
}
