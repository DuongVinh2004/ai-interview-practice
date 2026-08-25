interface ReadinessGaugeProps {
  score: number; // 0 - 100
  confidenceLow: number;
  confidenceHigh: number;
  size?: number;
}

export function ReadinessGauge({
  score,
  confidenceLow,
  confidenceHigh,
  size = 240,
}: ReadinessGaugeProps) {
  const strokeWidth = 18;
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;

  // Arc from -140 deg to +140 deg (280 deg sweep)
  const sweepAngle = 280;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(sweepAngle / 360) * circumference} ${circumference}`;

  const progressFraction = Math.min(1.0, Math.max(0.0, score / 100));
  const strokeDashoffset = (sweepAngle / 360) * circumference * (1 - progressFraction);

  const getGaugeColor = (val: number) => {
    if (val >= 85) return '#10b981'; // emerald-500
    if (val >= 70) return '#6366f1'; // indigo-500
    if (val >= 50) return '#f59e0b'; // amber-500
    return '#f43f5e'; // rose-500
  };

  const gaugeColor = getGaugeColor(score);

  return (
    <div
      className="flex flex-col items-center justify-center relative select-none"
      style={{ width: size, height: size }}
      data-testid="readiness-gauge"
    >
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Track Arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          transform={`rotate(130 ${center} ${center})`}
        />

        {/* Confidence Interval Background Band */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(99, 102, 241, 0.15)"
          strokeWidth={strokeWidth + 6}
          strokeDasharray={`${((confidenceHigh - confidenceLow) / 100) * (sweepAngle / 360) * circumference} ${circumference}`}
          strokeDashoffset={-((confidenceLow / 100) * (sweepAngle / 360) * circumference)}
          transform={`rotate(130 ${center} ${center})`}
        />

        {/* Colored Progress Arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={gaugeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(130 ${center} ${center})`}
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Center Value Content */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-extrabold tracking-tight text-slate-900">
          {score.toFixed(1)}
          <span className="text-xl text-slate-400 font-semibold">%</span>
        </span>

        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
          Readiness Index
        </span>

        {/* 95% Confidence Interval Tag */}
        <div className="mt-2 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-600 font-mono">
          95% CI: [{confidenceLow.toFixed(1)}% – {confidenceHigh.toFixed(1)}%]
        </div>
      </div>
    </div>
  );
}
