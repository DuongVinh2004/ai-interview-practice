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
    expect(screen.getByText(/Quyền riêng tư & xử lý giọng nói/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đồng ý và bắt đầu' })).toBeInTheDocument();

    // Grant consent
    const consentBtn = screen.getByRole('button', { name: 'Đồng ý và bắt đầu' });
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

  it('renders focused question and answer controls with a collapsed accessible history', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý và bắt đầu' }));

    await waitFor(() => {
      expect(screen.getByTestId('voice-interview-room')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Phỏng vấn giọng nói' })).toBeInTheDocument();
    expect(screen.getByText('AI Interviewer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Câu trả lời của bạn' })).toBeInTheDocument();
    expect(screen.getByText('Bắt đầu trả lời')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đọc lại câu hỏi' })).toBeDisabled();

    // Verify ARIA Live region on live transcript log
    const history = screen.getByText('Nội dung đã trao đổi').closest('details');
    expect(history).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Nội dung đã trao đổi'));
    const transcriptLog = screen.getByRole('log');
    expect(transcriptLog).toBeInTheDocument();
    expect(transcriptLog).toHaveAttribute('aria-live', 'polite');

    expect(screen.getByText('Bắt đầu trả lời')).toBeDisabled();

    // End call
    const endBtn = screen.getByRole('button', { name: 'Rời phiên' });
    fireEvent.click(endBtn);
    expect(onFinish).toHaveBeenCalled();
  });
});
