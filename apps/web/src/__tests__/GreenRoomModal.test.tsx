import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GreenRoomModal } from '../features/interview/GreenRoomModal';

describe('GreenRoomModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock mediaDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([
            { kind: 'audioinput', deviceId: 'default', label: 'Default Microphone' },
          ]),
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders green room modal with navigation tabs and device checks', async () => {
    const onReady = vi.fn();
    const onClose = vi.fn();

    render(
      <GreenRoomModal
        isOpen={true}
        onClose={onClose}
        onReady={onReady}
        sessionId="session-test-123"
        roleTitle="Senior Backend Engineer"
      />,
    );

    expect(screen.getByText(/Pre-Interview Green Room|Phòng Chuẩn Bị/i)).toBeInTheDocument();
    expect(screen.getByText(/Microphone/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Tai nghe & Loa|Loa \/ Tai nghe|Speakers? & Headphones|Speaker \/ Headphones/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Độ trễ mạng|Network Latency/i)).toBeInTheDocument();
  });

  it('navigates to 4-7-8 breathing relaxation tab and controls cycle', async () => {
    render(
      <GreenRoomModal
        isOpen={true}
        onClose={vi.fn()}
        onReady={vi.fn()}
        sessionId="session-test-123"
      />,
    );

    const breathingTab = screen.getByText(/Thư giãn 4-7-8|Relaxation 4-7-8/i);
    fireEvent.click(breathingTab);

    expect(screen.getByText(/Kỹ thuật thở 4-7-8|4-7-8 Relaxation Guide/i)).toBeInTheDocument();

    const startBtn = screen.getByText(/Bắt đầu bài tập thở|Start Breathing Exercise/i);
    fireEvent.click(startBtn);

    // Fast-forward timer
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    const stopBtn = screen.getByText(/Dừng bài tập|Stop Exercise/i);
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
  });

  it('switches to voice warm up tab and toggles 30s ice-breaker test', async () => {
    render(
      <GreenRoomModal
        isOpen={true}
        onClose={vi.fn()}
        onReady={vi.fn()}
        sessionId="session-test-123"
      />,
    );

    const warmupTab = screen.getByText(/Thử giọng|Voice Warm-up/i);
    fireEvent.click(warmupTab);

    expect(screen.getByText(/Câu hỏi thử giọng|30-Second Ice-breaker/i)).toBeInTheDocument();

    const recordBtn = screen.getByRole('button', {
      name: /Nói thử 1 câu|Record Test Answer/i,
    });
    fireEvent.click(recordBtn);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText(/Test Recording Preview|Bản ghi âm thử/i)).toBeInTheDocument();
  });

  it('triggers onReady when candidate clicks ready to start', () => {
    const onReady = vi.fn();
    render(
      <GreenRoomModal
        isOpen={true}
        onClose={vi.fn()}
        onReady={onReady}
        sessionId="session-test-123"
      />,
    );

    const readyBtn = screen.getByText(/Sẵn sàng vào phỏng vấn|Ready to Start Interview/i);
    fireEvent.click(readyBtn);

    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
