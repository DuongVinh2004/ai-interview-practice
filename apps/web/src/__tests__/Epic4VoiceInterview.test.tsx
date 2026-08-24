import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioAnswerRecorder } from '../components/audio/AudioAnswerRecorder';

describe('Epic 4 Voice Mode & AudioAnswerRecorder', () => {
  beforeEach(() => {
    // Mock Canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    }) as any;

    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      configurable: true,
      writable: true,
    });

    // Mock MediaRecorder
    (global as any).MediaRecorder = vi.fn().mockImplementation(() => {
      const recorderInstance: any = {
        state: 'inactive',
        mimeType: 'audio/webm',
        ondataavailable: null,
        onstop: null,
        start: vi.fn(() => {
          recorderInstance.state = 'recording';
        }),
        stop: vi.fn(() => {
          recorderInstance.state = 'inactive';
          if (recorderInstance.ondataavailable) {
            recorderInstance.ondataavailable({
              data: new Blob(['mock audio chunks'], { type: 'audio/webm' }),
            });
          }
          if (recorderInstance.onstop) {
            recorderInstance.onstop();
          }
        }),
      };
      return recorderInstance;
    });
    (global as any).MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

    // Mock AudioContext
    (global as any).AudioContext = vi.fn().mockImplementation(() => ({
      createMediaStreamSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
      }),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 256,
        smoothingTimeConstant: 0.8,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn(),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }));

    // Mock fetch for /audio/transcribe
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            data: {
              text: 'In event-driven architecture, services communicate asynchronously via event streams.',
              confidence: 0.98,
              durationSeconds: 6,
              provider: 'mock',
            },
          }),
        ),
    } as any);
  });

  it('renders record button initially', () => {
    const mockOnAnswerReady = vi.fn();
    render(<AudioAnswerRecorder onAnswerReady={mockOnAnswerReady} sessionId="test-session-1" />);

    const recordBtn = screen.getByTestId('record-toggle-btn');
    expect(recordBtn).toBeInTheDocument();
  });

  it('handles start and stop recording cycle and displays transcribed text', async () => {
    const mockOnAnswerReady = vi.fn();
    render(<AudioAnswerRecorder onAnswerReady={mockOnAnswerReady} sessionId="test-session-1" />);

    const recordBtn = screen.getByTestId('record-toggle-btn');
    
    // Start recording
    fireEvent.click(recordBtn);

    // Wait until recording is active
    await waitFor(() => {
      expect(screen.getByText(/Dừng ghi âm|Stop Recording/i)).toBeInTheDocument();
    });

    // Click to stop
    fireEvent.click(screen.getByTestId('record-toggle-btn'));

    // Transcript review textarea should appear with transcribed text
    await waitFor(() => {
      expect(
        screen.getByDisplayValue(
          'In event-driven architecture, services communicate asynchronously via event streams.',
        ),
      ).toBeInTheDocument();
    });

    // Submit answer
    const submitBtn = screen.getByRole('button', { name: /Submit Answer|Nộp câu trả lời/i });
    fireEvent.click(submitBtn);

    expect(mockOnAnswerReady).toHaveBeenCalledWith(
      'In event-driven architecture, services communicate asynchronously via event streams.',
    );
  });
});
