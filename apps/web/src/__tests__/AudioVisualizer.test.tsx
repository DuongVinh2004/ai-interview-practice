import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioVisualizer } from '../components/audio/AudioVisualizer';

describe('AudioVisualizer Component', () => {
  beforeEach(() => {
    // Mock HTMLCanvasElement.prototype.getContext for jsdom
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    }) as any;
  });

  it('renders canvas element properly', () => {
    render(<AudioVisualizer isActive={false} mode="bars" theme="idle" />);
    const canvas = screen.getByTestId('audio-visualizer-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders with active state in wave mode', () => {
    const mockAnalyserData = vi.fn().mockReturnValue(new Uint8Array([50, 100, 150, 200]));
    render(
      <AudioVisualizer
        isActive={true}
        getAnalyserData={mockAnalyserData}
        mode="wave"
        theme="user"
        height={60}
      />,
    );
    const canvas = screen.getByTestId('audio-visualizer-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders with AI theme in bars mode', () => {
    render(<AudioVisualizer isActive={true} mode="bars" theme="ai" />);
    const canvas = screen.getByTestId('audio-visualizer-canvas');
    expect(canvas).toBeInTheDocument();
  });
});
