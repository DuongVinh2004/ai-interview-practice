import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  color?: string;
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isActive,
  color = '#10b981',
  barCount = 16,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 4;
        if (isActive) {
          // Dynamic sine-wave random fluctuation
          const time = Date.now() * 0.008;
          const freq = Math.sin(time + i * 0.5);
          barHeight = Math.max(4, Math.abs(freq) * (height - 8) + Math.random() * 6);
        }

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, color, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={36}
      data-testid="audio-visualizer"
      className="w-28 h-9"
    />
  );
};
