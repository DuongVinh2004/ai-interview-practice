import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VoiceInterviewRoom } from '../components/interview/VoiceInterviewRoom';

const voice = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  initPlaybackAudio: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  replayQuestion: vi.fn(),
  triggerBargeIn: vi.fn(),
  resetSilenceTimer: vi.fn(),
  connectionStatus: 'LIVE',
  isMuted: true,
  isAiSpeaking: false,
  isCandidateSpeaking: false,
  isFallbackToRest: false,
  isProlongedSilence: false,
  silenceDurationSec: 0,
  bargeInCount: 0,
  sessionCompleted: false,
  errorMessage: null,
  transcripts: [],
  recordingText: '',
  recordingStatus: 'IDLE',
  networkQuality: { latencyMs: 0, quality: 'GOOD', jitterMs: 0, packetLossRate: 0 },
}));
vi.mock('../hooks/useVoiceStreaming', () => ({ useVoiceStreaming: () => voice }));
vi.mock('../lib/api-client', () => ({ apiClient: { post: vi.fn().mockResolvedValue({}) } }));
vi.mock('../components/interview/AudioVisualizer', () => ({ AudioVisualizer: () => null }));

describe('Voice answer review before submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voice.recordingText = '';
    voice.recordingStatus = 'IDLE';
    // Node 26 exposes its own storage; use an isolated browser-like store for this fixture.
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  const room = (
    submit: (text: string, turn: string) => Promise<void>,
    interviewId: string,
    turnId = 'turn1',
  ) => (
    <MemoryRouter>
      <VoiceInterviewRoom
        interviewId={interviewId}
        userId="test-user"
        turnId={turnId}
        currentQuestion="Giải thích API"
        sessionState="ACTIVE"
        onRestAnswerSubmit={submit}
      />
    </MemoryRouter>
  );
  const consent = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý và bắt đầu' }));
    await screen.findByRole('textbox', { name: 'Câu trả lời của bạn' });
  };
  it('keeps STT as a draft, appends another recording, ignores late edits and sends once', async () => {
    let resolve!: () => void;
    const submit = vi.fn(
      () =>
        new Promise<void>(done => {
          resolve = done;
        }),
    );
    const view = render(room(submit, 'edit-append'));
    await consent();
    fireEvent.click(screen.getByText('Bắt đầu trả lời'));
    expect(voice.startRecording).toHaveBeenCalledWith('turn1');
    voice.recordingStatus = 'RECORDING';
    voice.recordingText = 'bản nhận diện';
    view.rerender(room(submit, 'edit-append'));
    expect(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })).toHaveValue(
      'bản nhận diện',
    );
    expect(screen.getByText('Gửi câu trả lời')).toBeDisabled();
    fireEvent.click(screen.getByText('Dừng ghi âm'));
    expect(voice.stopRecording).toHaveBeenCalled();
    voice.recordingStatus = 'IDLE';
    view.rerender(room(submit, 'edit-append'));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' }), {
      target: { value: 'Đã sửa API.' },
    });
    voice.recordingText = 'late text';
    view.rerender(room(submit, 'edit-append'));
    expect(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })).toHaveValue('Đã sửa API.');
    fireEvent.click(screen.getByText('Nói bổ sung'));
    voice.recordingText = 'Thêm ví dụ.';
    voice.recordingStatus = 'RECORDING';
    view.rerender(room(submit, 'edit-append'));
    expect(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })).toHaveValue(
      'Đã sửa API. Thêm ví dụ.',
    );
    voice.recordingStatus = 'IDLE';
    view.rerender(room(submit, 'edit-append'));
    const send = screen.getByRole('button', { name: 'Gửi câu trả lời' });
    fireEvent.click(send);
    fireEvent.click(send);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith('Đã sửa API. Thêm ví dụ.', 'turn1');
    resolve();
    await screen.findByTestId('voice-answer-accepted');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('restores only the current turn draft and retains it after a send failure', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Mất mạng'));
    const view = render(room(submit, 'restore'));
    await consent();
    fireEvent.change(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' }), {
      target: { value: 'Bản nháp riêng' },
    });
    fireEvent.click(screen.getByText('Gửi câu trả lời'));
    await screen.findByText('Mất mạng');
    view.unmount();
    const restored = render(room(submit, 'restore'));
    await consent();
    expect(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })).toHaveValue(
      'Bản nháp riêng',
    );
    restored.rerender(room(submit, 'restore', 'turn2'));
    expect(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })).toHaveValue('');
  });
  it('keeps the draft when cancelling leave and prevents leaving during recording', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const view = render(room(submit, 'leave-draft'));
    await consent();
    fireEvent.change(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' }), {
      target: { value: 'Bản nháp cần giữ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rời phiên' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Bản nháp đã lưu trên thiết bị này/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ở lại' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })).toHaveValue(
      'Bản nháp cần giữ',
    );
    expect(submit).not.toHaveBeenCalled();

    voice.recordingStatus = 'RECORDING';
    view.rerender(room(submit, 'leave-draft'));
    expect(screen.getByRole('button', { name: 'Gửi câu trả lời' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Rời phiên' }));
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Rời phiên' }),
    ).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Câu trả lời của bạn' })).toHaveValue(
      'Bản nháp cần giữ',
    );
  });
});
