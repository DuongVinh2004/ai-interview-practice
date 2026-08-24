import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioVisualizer } from '../components/interview/AudioVisualizer';
import { NetworkQualityBadge } from '../components/interview/NetworkQualityBadge';
import { VoiceInterviewRoom } from '../components/interview/VoiceInterviewRoom';
import { MemoryRouter } from 'react-router-dom';

describe('Voice Streaming Components (F001)', () => {
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
      />
    );

    expect(screen.getByTestId('network-quality-badge')).toBeInTheDocument();
    expect(screen.getByText('18ms')).toBeInTheDocument();
  });

  it('renders VoiceInterviewRoom with controls and avatars', () => {
    const onFinish = vi.fn();

    render(
      <MemoryRouter>
        <VoiceInterviewRoom
          interviewId="interview-voice-123"
          roleName="Staff Backend Engineer"
          levelName="STAFF"
          onFinish={onFinish}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('voice-interview-room')).toBeInTheDocument();
    expect(screen.getByText(/Live Voice Interview/i)).toBeInTheDocument();
    expect(screen.getByText('AI Technical Interviewer')).toBeInTheDocument();
    expect(screen.getByText('Ứng viên (Bạn)')).toBeInTheDocument();
    expect(screen.getByText('Tắt Micro')).toBeInTheDocument();
    expect(screen.getByText('Ngắt lời AI (Barge-in)')).toBeInTheDocument();

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
