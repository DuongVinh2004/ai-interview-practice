import { useEffect, useRef } from 'react';

export interface AudioVisualizerProps {
  isActive: boolean;
  getAnalyserData?: () => Uint8Array | null;
  mode?: 'wave' | 'bars';
  theme?: 'user' | 'ai' | 'idle';
  height?: number;
  className?: string;
}

export function AudioVisualizer({
  isActive,
  getAnalyserData,
  mode = 'bars',
  theme = 'idle',
  height = 56,
  className = '',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      // Fetch live frequency data if available
      const data = isActive && getAnalyserData ? getAnalyserData() : null;
      phaseRef.current += 0.05;

      if (mode === 'bars') {
        const numBars = 32;
        const barWidth = (width / numBars) * 0.65;
        const gap = (width / numBars) * 0.35;

        for (let i = 0; i < numBars; i++) {
          let value = 0;
          if (data && data.length > 0) {
            const dataIndex = Math.floor((i / numBars) * data.length);
            value = data[dataIndex] / 255;
          } else if (isActive) {
            // Simulated gentle rhythmic pulsing when active without direct analyser
            value = (Math.sin(phaseRef.current + i * 0.3) + 1) * 0.35 + 0.15;
          } else {
            // Idle subtle background line
            value = 0.06;
          }

          const barHeight = Math.max(4, value * (h - 8));
          const x = i * (barWidth + gap) + gap / 2;
          const y = (h - barHeight) / 2;

          // Color gradient according to theme
          const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
          if (theme === 'user') {
            gradient.addColorStop(0, '#10b981'); // emerald-500
            gradient.addColorStop(1, '#06b6d4'); // cyan-500
          } else if (theme === 'ai') {
            gradient.addColorStop(0, '#6366f1'); // indigo-500
            gradient.addColorStop(1, '#a855f7'); // purple-500
          } else {
            gradient.addColorStop(0, '#94a3b8'); // slate-400
            gradient.addColorStop(1, '#cbd5e1'); // slate-300
          }

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 3);
          ctx.fill();
        }
      } else {
        // Wave mode (fluid sinusoidal curve)
        ctx.lineWidth = 2.5;
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        if (theme === 'user') {
          gradient.addColorStop(0, '#10b981');
          gradient.addColorStop(0.5, '#06b6d4');
          gradient.addColorStop(1, '#10b981');
        } else if (theme === 'ai') {
          gradient.addColorStop(0, '#6366f1');
          gradient.addColorStop(0.5, '#a855f7');
          gradient.addColorStop(1, '#6366f1');
        } else {
          gradient.addColorStop(0, '#cbd5e1');
          gradient.addColorStop(1, '#94a3b8');
        }
        ctx.strokeStyle = gradient;

        ctx.beginPath();
        const sliceWidth = width / 64;
        let x = 0;

        for (let i = 0; i <= 64; i++) {
          let amplitude = isActive ? (h / 2) * 0.7 : h * 0.08;
          if (data && data.length > 0) {
            const dataIndex = Math.floor((i / 64) * (data.length / 2));
            amplitude = (data[dataIndex] / 255) * (h / 2) * 0.85;
          }

          const y = h / 2 + Math.sin(i * 0.2 + phaseRef.current) * amplitude;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, getAnalyserData, mode, theme]);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-xl ${className}`}>
      <canvas
        ref={canvasRef}
        width={380}
        height={height}
        className="w-full h-full block"
        style={{ height: `${height}px` }}
        data-testid="audio-visualizer-canvas"
      />
    </div>
  );
}
