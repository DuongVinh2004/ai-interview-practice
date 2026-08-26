import { Subject } from 'rxjs';
import { SpeakerRole } from '@ai-interview/contracts';

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  confidence?: number;
  speaker?: SpeakerRole;
  startTimeMs?: number;
  endTimeMs?: number;
}

export interface SttStreamSession {
  sendAudioChunk(pcmChunk: Buffer): void;
  events: Subject<TranscriptEvent>;
  close(): void;
}

export interface TtsStreamSession {
  sendText(text: string): void;
  audioStream: Subject<Buffer>;
  flush(): void;
  close(): void;
}

export interface VoiceLatencyMetrics {
  sttLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
  totalRoundTripMs: number;
}
