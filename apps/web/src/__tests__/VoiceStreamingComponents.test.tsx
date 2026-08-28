import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioVisualizer } from '../components/interview/AudioVisualizer';
import { NetworkQualityBadge } from '../components/interview/NetworkQualityBadge';
import { VoiceInterviewRoom } from '../components/interview/VoiceInterviewRoom';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../lib/api-client';

vi.mock('../lib/api-client', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ consented: true }),
    get: vi.fn().mockResolvedValue({}),
  },
}));

describe('Voice Streaming Components (F001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AudioVisualizer canvas', () => {
    render(<AudioVisualizer isActive={true} color="#10b981" />);
    expect(screen.getByTestId('audio-visualizer')).toBeInTheDocument();
  });

  it('renders NetworkQualityBadge with latency info', () => {
    render(
      <NetworkQualityBadge
        quality={{
          latencyMs: 18,
          jitterMs: 2,
          packetLossRate: 0.001,
          quality: 'EXCELLENT',
        }}
      />,
    );

    expect(screen.getByTestId('network-quality-badge')).toBeInTheDocument();
    expect(screen.getByText('18ms')).toBeInTheDocument();
  });

  it('blocks microphone stream until user grants explicit voice consent (FINDING-001)', async () => {
    render(
      <MemoryRouter>
        <VoiceInterviewRoom
          interviewId="interview-voice-123"
          roleName="Staff Backend Engineer"
          levelName="STAFF"
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('voice-consent-modal')).toBeInTheDocument();
    expect(screen.getByText(/Xác Nhận Quyền Riêng Tư & Xử Lý Giọng Nói/i)).toBeInTheDocument();
    expect(screen.getByText(/Tôi Đồng Ý & Bắt Đầu Phỏng Vấn/i)).toBeInTheDocument();

    // Grant consent
    const consentBtn = screen.getByText(/Tôi Đồng Ý & Bắt Đầu Phỏng Vấn/i);
    fireEvent.click(consentBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/voice-gateway/consent',
        expect.objectContaining({ interviewId: 'interview-voice-123' }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('voice-interview-room')).toBeInTheDocument();
    });
  });

  it('renders VoiceInterviewRoom with controls, avatars, and ARIA live region (FINDING-007)', async () => {
    const onFinish = vi.fn();

    render(
      <MemoryRouter>
        <VoiceInterviewRoom
          interviewId="interview-voice-123"
          roleName="Staff Backend Engineer"
          levelName="STAFF"
          onFinish={onFinish}
        />
      </MemoryRouter>,
    );

    // Accept consent
    fireEvent.click(screen.getByText(/Tôi Đồng Ý & Bắt Đầu Phỏng Vấn/i));

    await waitFor(() => {
      expect(screen.getByTestId('voice-interview-room')).toBeInTheDocument();
    });

    expect(screen.getByText(/Live Voice Interview/i)).toBeInTheDocument();
    expect(screen.getByText('AI Technical Interviewer')).toBeInTheDocument();
    expect(screen.getByText('Ứng viên (Bạn)')).toBeInTheDocument();
    expect(screen.getByText('Tắt Micro')).toBeInTheDocument();
    expect(screen.getByText('Ngắt lời AI (Barge-in)')).toBeInTheDocument();

    // Verify ARIA Live region on live transcript log
    const transcriptLog = screen.getByRole('log');
    expect(transcriptLog).toBeInTheDocument();
    expect(transcriptLog).toHaveAttribute('aria-live', 'polite');

    // Toggle mute
    const muteBtn = screen.getByText('Tắt Micro');
    fireEvent.click(muteBtn);
    expect(screen.getByText('Bật Micro')).toBeInTheDocument();

    // End call
    const endBtn = screen.getByText('Kết thúc Phỏng vấn');
    fireEvent.click(endBtn);
    expect(onFinish).toHaveBeenCalled();
  });
});
