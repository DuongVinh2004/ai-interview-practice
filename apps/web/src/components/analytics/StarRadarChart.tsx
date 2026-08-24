import React, { useState } from 'react';
import { StarRubricScores } from '@ai-interview/contracts';

interface StarRadarChartProps {
  scores: StarRubricScores;
  size?: number;
}

export const StarRadarChart: React.FC<StarRadarChartProps> = ({ scores, size = 300 }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const dimensions = [
    { key: 'situation', name: 'Situation', rawScore: scores.situationScore, max: 4, normalized: (scores.situationScore / 4) * 10 },
    { key: 'task', name: 'Task', rawScore: scores.taskScore, max: 4, normalized: (scores.taskScore / 4) * 10 },
    { key: 'action', name: 'Action', rawScore: scores.actionScore, max: 4, normalized: (scores.actionScore / 4) * 10 },
    { key: 'result', name: 'Result', rawScore: scores.resultScore, max: 4, normalized: (scores.resultScore / 4) * 10 },
    { key: 'structure', name: 'Structure', rawScore: scores.structureScore, max: 2, normalized: (scores.structureScore / 2) * 10 },
  ];

  const center = size / 2;
  const radius = size / 2 - 40;
  const count = dimensions.length;
  const angleStep = (Math.PI * 2) / count;
  const levels = [2, 4, 6, 8, 10];

  const getCoordinates = (index: number, value: number, max: number = 10) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / max) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const polygonPoints = dimensions
    .map((d, i) => {
      const { x, y } = getCoordinates(i, d.normalized);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="relative flex flex-col items-center justify-center select-none" data-testid="star-radar-chart">
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
              fill={level === 10 ? 'rgba(238, 242, 255, 0.6)' : 'none'}
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray={level % 4 === 0 ? undefined : '2 2'}
            />
          );
        })}

        {/* Axis Lines radiating from center */}
        {dimensions.map((_, i) => {
          const { x, y } = getCoordinates(i, 10);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#94a3b8"
              strokeWidth="1"
            />
          );
        })}

        {/* Data Area Polygon */}
        <polygon
          points={polygonPoints}
          fill="url(#starGradient)"
          stroke="#6366f1"
          strokeWidth="2.5"
          className="transition-all duration-500 ease-out"
        />

        {/* Gradients */}
        <defs>
          <linearGradient id="starGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Data Points */}
        {dimensions.map((d, i) => {
          const { x, y } = getCoordinates(i, d.normalized);
          const isHovered = hoveredIndex === i;

          return (
            <circle
              key={d.key}
              cx={x}
              cy={y}
              r={isHovered ? 6.5 : 4.5}
              fill={isHovered ? '#4338ca' : '#6366f1'}
              stroke="#ffffff"
              strokeWidth="2"
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}

        {/* Axis Labels */}
        {dimensions.map((d, i) => {
          const { x, y } = getCoordinates(i, 11.5);
          const isHovered = hoveredIndex === i;

          return (
            <text
              key={`label-${d.key}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={`text-[11px] font-bold transition-colors cursor-pointer ${
                isHovered ? 'fill-indigo-700' : 'fill-slate-700'
              }`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {d.name}
            </text>
          );
        })}
      </svg>

      {/* Hover Info Tooltip */}
      {hoveredIndex !== null && dimensions[hoveredIndex] && (
        <div className="absolute bottom-0 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2 pointer-events-none">
          <span className="font-semibold">{dimensions[hoveredIndex].name}:</span>
          <span className="text-indigo-300 font-bold font-mono">
            {dimensions[hoveredIndex].rawScore} / {dimensions[hoveredIndex].max}
          </span>
        </div>
      )}
    </div>
  );
};
