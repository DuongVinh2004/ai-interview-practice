import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VoiceModeControls } from '../components/audio/VoiceModeControls';
import { useAudioSettingsStore } from '../stores/audio-settings.store';
import { InterviewMode } from '@ai-interview/contracts';

describe('VoiceModeControls Component', () => {
  it('renders mode switch buttons for Text and Voice', () => {
    render(<VoiceModeControls />);
    expect(screen.getByTestId('mode-text-btn')).toBeInTheDocument();
    expect(screen.getByTestId('mode-voice-btn')).toBeInTheDocument();
  });

  it('switches mode to Voice when Voice button clicked', () => {
    render(<VoiceModeControls />);
    const voiceBtn = screen.getByTestId('mode-voice-btn');
    fireEvent.click(voiceBtn);

    expect(useAudioSettingsStore.getState().mode).toBe(InterviewMode.VOICE);
  });

  it('opens audio settings modal when settings button clicked', () => {
    render(<VoiceModeControls />);
    const settingsBtn = screen.getByTestId('audio-settings-btn');
    fireEvent.click(settingsBtn);

    expect(screen.getAllByText(/Audio & Voice Settings|Cài đặt Âm thanh/i)[0]).toBeInTheDocument();
  });

  it('triggers onPlayAiSpeech callback when play is clicked', () => {
    useAudioSettingsStore.getState().setMode(InterviewMode.VOICE);
    const mockPlay = vi.fn();
    render(<VoiceModeControls onPlayAiSpeech={mockPlay} isAiSpeaking={false} />);

    const playBtn = screen.getByTitle(/Play|Nghe AI/i);
    fireEvent.click(playBtn);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });
});
