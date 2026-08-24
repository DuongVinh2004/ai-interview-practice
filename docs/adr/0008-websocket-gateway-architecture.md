# ADR 0008: Low-Overhead WebSocket Gateway Architecture for Real-Time Voice Streaming

## Status

Accepted

## Context

Feature F001 requires full-duplex live voice streaming between candidate and AI interviewer. Binary audio frames (Opus / PCM) must be transferred with sub-200ms latency to provide natural conversational interaction, voice activity detection (VAD), barge-in / interruption handling, and live transcripts.

## Decision

1. We use native WebSocket server implementation via `@nestjs/websockets` with the lightweight `ws` transport rather than `Socket.io`.
2. Binary Opus audio frames flow directly over raw WebSocket channels, avoiding Socket.io packet wrapping overhead and excessive client bundle size.
3. Client reconnections are handled via application-level exponential backoff in `useVoiceStreaming`.
4. The backend voice gateway implements a `VadEngineService` for energy-based voice activity detection and barge-in interruption.
5. In development and CI environments, a `MockVoiceProvider` provides deterministic transcriptions and silent/mock TTS audio streaming without needing external vendor STT/TTS credentials.
6. A graceful degradation circuit monitors stream latency and packet loss: if latency exceeds 2000ms over consecutive chunks, the system automatically triggers a fallback event to standard text interview mode.

## Consequences

- **Positive**: Minimal latency overhead, direct control over binary buffers, lightweight client payload, robust offline/CI testing support.
- **Negative**: Manual management of connection heartbeat and reconnection logic compared to high-level Socket.io abstractions.
