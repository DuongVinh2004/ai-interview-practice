import { CompetencyArea } from '@ai-interview/contracts';

export interface CompetencyRadarItem {
  area: CompetencyArea;
  name: string;
  score: number;
  benchmarkP50: number;
  percentile?: number | null;
}

interface CompetencyRadarOverlayProps {
  data: CompetencyRadarItem[];
  size?: number;
  targetRoleName?: string;
}

export function CompetencyRadarOverlay({
  data,
  size = 360,
  targetRoleName = 'Senior Benchmark',
}: CompetencyRadarOverlayProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl"
        style={{ width: size, height: size }}
      >
        <p className="text-xs text-slate-400">No competency data available</p>
      </div>
    );
  }

  const center = size / 2;
  const radius = size * 0.38;
  const numVertices = data.length;
  const angleStep = (Math.PI * 2) / numVertices;

  // Grid levels (2, 4, 6, 8, 10)
  const levels = [2, 4, 6, 8, 10];

  const getCoordinates = (value: number, index: number, maxVal = 10) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / maxVal) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const userPoints = data.map((d, i) => getCoordinates(d.score, i));
  const benchmarkPoints = data.map((d, i) => getCoordinates(d.benchmarkP50, i));

  const userPath = userPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  const benchmarkPath = benchmarkPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div className="flex flex-col items-center gap-3" data-testid="competency-radar-overlay">
      <svg width={size} height={size} className="overflow-visible select-none">
        {/* Background Grid Circles / Polygons */}
        {levels.map(lvl => {
          const gridPoints = data.map((_, i) => getCoordinates(lvl, i));
          const gridPath = gridPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          return (
            <g key={lvl}>
              <path d={gridPath} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,3" />
              <text
                x={center}
                y={center - (lvl / 10) * radius + 4}
                className="text-[9px] fill-slate-400 font-mono text-anchor-middle"
                textAnchor="middle"
              >
                {lvl}
              </text>
            </g>
          );
        })}

        {/* Radial Axis Lines */}
        {data.map((_, i) => {
          const edge = getCoordinates(10, i);
          return <line key={i} x1={center} y1={center} x2={edge.x} y2={edge.y} stroke="#cbd5e1" strokeWidth="1" />;
        })}

        {/* Benchmark Polygon */}
        <path
          d={benchmarkPath}
          fill="rgba(99, 102, 241, 0.08)"
          stroke="#6366f1"
          strokeWidth="2"
          strokeDasharray="4,4"
          className="transition-all duration-300"
        />

        {/* Candidate User Polygon */}
        <path
          d={userPath}
          fill="rgba(16, 185, 129, 0.25)"
          stroke="#10b981"
          strokeWidth="2.5"
          className="transition-all duration-300"
        />

        {/* Candidate Data Dots */}
        {userPoints.map((p, i) => (
          <circle
            key={`user-dot-${i}`}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#10b981"
            stroke="#ffffff"
            strokeWidth="1.5"
            className="hover:scale-125 transition-transform"
          />
        ))}

        {/* Area Labels */}
        {data.map((item, i) => {
          const labelCoord = getCoordinates(11.8, i);
          const shortName =
            item.name.length > 18 ? item.name.substring(0, 16) + '...' : item.name;
          return (
            <text
              key={`label-${i}`}
              x={labelCoord.x}
              y={labelCoord.y}
              textAnchor="middle"
              className="text-[11px] font-semibold fill-slate-700"
            >
              {shortName}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-600 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
          <span className="font-medium">Candidate Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-indigo-500 border-dashed" />
          <span className="font-medium">{targetRoleName} (P50)</span>
        </div>
      </div>
    </div>
  );
}
