#!/usr/bin/env node

/**
 * Voice Gateway Pipeline Latency Benchmark CLI
 *
 * Measures end-to-end latency for STT -> LLM -> TTS pipeline:
 *   T0: First audio chunk sent
 *   T1: FINAL_TRANSCRIPT event received
 *   T2: First TTS audio chunk received
 *
 * Metrics:
 *   - STT Latency = T1 - T0
 *   - Total TTFB  = T2 - T0
 *
 * Usage:
 *   node infra/scripts/voice-latency-benchmark.mjs --help
 *   node infra/scripts/voice-latency-benchmark.mjs --url ws://localhost:3000/voice --token <JWT>
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

// Resolve WebSocket client (Node.js 22 native WebSocket or ws module)
let WebSocketClient = globalThis.WebSocket;
if (!WebSocketClient) {
  try {
    const wsModule = await import('ws');
    WebSocketClient = wsModule.default || wsModule.WebSocket;
  } catch {
    // Will throw below if needed
  }
}

/**
 * Generate 3-second 16kHz 16-bit Mono PCM WAV buffer
 * Synthesizes voice-like audio with formant frequencies ("Hello, how are you?")
 */
export function generateSyntheticWavBuffer(durationSec = 3, sampleRate = 16000) {
  const numSamples = durationSec * sampleRate;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * (bitsPerSample / 8);
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt Subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat: PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data Subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Speech-like waveform synthesis (Vocal formants at ~220Hz, 700Hz, 1200Hz modulated)
  let offset = headerSize;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Amplitude envelope: 4 syllables ("Hel-lo, how are you")
    const envelope = Math.sin(Math.PI * (t % 0.75) / 0.75) * (t < 2.8 ? 1.0 : 0.0);
    // Harmonics
    const f0 = 220; // Fundamental pitch
    const sampleVal = envelope * (
      0.5 * Math.sin(2 * Math.PI * f0 * t) +
      0.3 * Math.sin(2 * Math.PI * (f0 * 2) * t) +
      0.2 * Math.sin(2 * Math.PI * (f0 * 3) * t)
    );
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 16384)));
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

export function parseCliArgs(args = process.argv.slice(2)) {
  const options = {
    help: false,
    url: 'ws://localhost:3000/voice',
    token: null,
    audioPath: null,
    threshold: 800,
    chunkSize: 1600,       // 1600 bytes = 100ms at 16kHz 16-bit mono
    chunkInterval: 50,     // 50ms stream interval
    timeout: 15000,        // 15 seconds max wait
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (arg === '--token' && args[i + 1]) {
      options.token = args[++i];
    } else if (arg === '--audio' && args[i + 1]) {
      options.audioPath = args[++i];
    } else if (arg === '--threshold' && args[i + 1]) {
      options.threshold = parseInt(args[++i], 10);
    } else if (arg === '--chunk-size' && args[i + 1]) {
      options.chunkSize = parseInt(args[++i], 10);
    } else if (arg === '--chunk-interval' && args[i + 1]) {
      options.chunkInterval = parseInt(args[++i], 10);
    } else if (arg === '--timeout' && args[i + 1]) {
      options.timeout = parseInt(args[++i], 10);
    }
  }

  return options;
}

export function printUsage() {
  console.log(`
Voice Latency Benchmark Tool
Measures end-to-end STT -> LLM -> TTS pipeline latency over WebSocket.

Usage:
  node infra/scripts/voice-latency-benchmark.mjs [options]

Options:
  --help, -h             Show this help message
  --url <ws-url>         Voice Gateway WebSocket URL (default: ws://localhost:3000/voice)
  --token <jwt>          JWT Bearer token for authentication
  --audio <file-path>    Path to input 3s WAV audio file (synthesized if omitted)
  --threshold <ms>       Max acceptable TTFB latency in milliseconds (default: 800)
  --chunk-size <bytes>   Audio streaming chunk size in bytes (default: 1600)
  --chunk-interval <ms>  Interval between audio chunk transmissions (default: 50)
  --timeout <ms>         Benchmark timeout in milliseconds (default: 15000)

Exit Codes:
  0: Success (TTFB <= threshold or server offline graceful skip)
  1: Latency violation (TTFB > threshold) or benchmark timeout
`);
}

export async function runBenchmark(options) {
  if (options.help) {
    printUsage();
    return { skipped: false, success: true, exitCode: 0 };
  }

  console.log('==============================================================================');
  console.log('🎙️  [Voice Gateway] Pipeline Latency Benchmark (STT -> LLM -> TTS)');
  console.log(`📡 Target Endpoint: ${options.url}`);
  console.log(`⏱️  TTFB Threshold : ${options.threshold}ms`);
  console.log('==============================================================================\n');

  // Prepare 3-second WAV audio buffer
  let wavBuffer;
  if (options.audioPath && fs.existsSync(options.audioPath)) {
    console.log(`📁 Loading audio file: ${options.audioPath}`);
    wavBuffer = fs.readFileSync(options.audioPath);
  } else {
    console.log('🎵 Generating synthetic 3-second 16kHz 16-bit WAV ("Hello, how are you?")...');
    wavBuffer = generateSyntheticWavBuffer(3, 16000);
  }

  // Extract raw PCM audio (strip 44-byte WAV header if standard RIFF)
  const pcmBuffer = wavBuffer.subarray(44);
  console.log(`📦 Audio payload: ${pcmBuffer.length} bytes PCM (${(pcmBuffer.length / 32000).toFixed(1)}s)\n`);

  if (!WebSocketClient) {
    console.error('❌ WebSocket client not available in runtime.');
    process.exit(1);
  }

  return new Promise((resolve) => {
    let ws;
    let isConnected = false;
    let hasSkipped = false;
    let t0 = null; // Timestamp: first chunk sent
    let t1 = null; // Timestamp: FINAL_TRANSCRIPT received
    let t2 = null; // Timestamp: first TTS audio chunk received
    let streamTimer = null;
    let timeoutTimer = null;

    const cleanup = () => {
      if (streamTimer) clearInterval(streamTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (ws) {
        try {
          ws.close();
        } catch {
          // Ignore close error
        }
      }
    };

    const handleGracefulSkip = (reason) => {
      if (hasSkipped) return;
      hasSkipped = true;
      cleanup();
      console.warn(`⚠️  [WARN] Voice Gateway server not reachable at ${options.url}.`);
      console.warn(`   Reason: ${reason}. Skipping benchmark (graceful exit for CI).`);
      resolve({ skipped: true, success: true, exitCode: 0 });
    };

    try {
      ws = new WebSocketClient(options.url);
    } catch (err) {
      handleGracefulSkip(`Failed to instantiate WebSocket: ${err.message}`);
      return;
    }

    // Graceful skip if server is offline or fails to connect
    ws.onerror = (error) => {
      if (!isConnected) {
        handleGracefulSkip('Connection refused or network unavailable');
      } else {
        console.error('❌ WebSocket error during benchmark:', error.message || error);
        cleanup();
        resolve({ skipped: false, success: false, exitCode: 1 });
      }
    };

    ws.onclose = (event) => {
      if (!isConnected) {
        handleGracefulSkip(`Connection closed before establishment (code ${event.code})`);
      }
    };

    timeoutTimer = setTimeout(() => {
      if (isConnected && !t2) {
        console.error(`\n❌ [TIMEOUT] Benchmark timed out after ${options.timeout}ms waiting for TTS response.`);
        cleanup();
        resolve({ skipped: false, success: false, exitCode: 1 });
      }
    }, options.timeout);

    ws.onopen = () => {
      isConnected = true;
      console.log('✅ WebSocket connected to Voice Gateway.');

      // 1. Send handshake / connect event if token is provided
      if (options.token) {
        const connectMsg = JSON.stringify({
          type: 'voice:connect',
          token: options.token,
          sampleRate: 16000,
        });
        ws.send(connectMsg);
      }

      // 2. Stream audio chunks to gateway
      let offset = 0;
      const chunkSize = options.chunkSize;

      streamTimer = setInterval(() => {
        if (offset >= pcmBuffer.length) {
          clearInterval(streamTimer);
          streamTimer = null;
          console.log('📤 Audio streaming complete. Awaiting pipeline response...\n');
          return;
        }

        const chunk = pcmBuffer.subarray(offset, offset + chunkSize);
        if (offset === 0) {
          t0 = performance.now();
          console.log(`⏱️  [T0] Sent first audio chunk at ${new Date().toISOString()}`);
        }

        try {
          ws.send(chunk);
        } catch (sendErr) {
          console.error('❌ Error sending audio chunk:', sendErr.message);
          cleanup();
          resolve({ skipped: false, success: false, exitCode: 1 });
          return;
        }

        offset += chunkSize;
      }, options.chunkInterval);
    };

    ws.onmessage = (event) => {
      const now = performance.now();
      const data = event.data;

      // Handle binary audio from TTS
      const isBinary = data instanceof ArrayBuffer || (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) || data instanceof Uint8Array;

      if (isBinary) {
        if (!t2) {
          t2 = now;
          console.log(`⏱️  [T2] Received first TTS audio binary chunk (${data.byteLength || data.length} bytes)`);
          evaluateAndComplete();
        }
        return;
      }

      // Handle JSON text events
      try {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        const parsed = JSON.parse(text);
        const eventType = parsed.type || parsed.event;

        if (eventType === 'voice:final_transcript' || eventType === 'FINAL_TRANSCRIPT') {
          if (!t1) {
            t1 = now;
            console.log(`⏱️  [T1] Received FINAL_TRANSCRIPT: "${parsed.text || parsed.transcript || ''}"`);
          }
        }

        if (
          eventType === 'voice:ai_audio_chunk' ||
          eventType === 'AI_AUDIO_CHUNK' ||
          eventType === 'voice:ai_speaking_start' ||
          eventType === 'AI_SPEAKING_START'
        ) {
          if (!t2) {
            t2 = now;
            console.log(`⏱️  [T2] Received TTS event (${eventType})`);
            evaluateAndComplete();
          }
        }
      } catch {
        // Non-JSON string or binary packet
        if (!t2) {
          t2 = now;
          console.log('⏱️  [T2] Received raw audio stream chunk');
          evaluateAndComplete();
        }
      }
    };

    function evaluateAndComplete() {
      cleanup();

      const sttLatency = t1 && t0 ? Math.round(t1 - t0) : 'N/A';
      const totalTtfb = t2 && t0 ? Math.round(t2 - t0) : 0;
      const isPass = typeof totalTtfb === 'number' && totalTtfb <= options.threshold;

      console.log('\n==============================================================================');
      console.log('📊 [Voice Latency Benchmark Results]');
      console.log('==============================================================================');

      const resultsTable = [
        {
          Metric: 'STT Latency (T1 - T0)',
          Measured: typeof sttLatency === 'number' ? `${sttLatency} ms` : sttLatency,
          Threshold: '-',
          Status: 'OK',
        },
        {
          Metric: 'Total TTFB (T2 - T0)',
          Measured: `${totalTtfb} ms`,
          Threshold: `<= ${options.threshold} ms`,
          Status: isPass ? '✅ PASS' : '❌ FAIL',
        },
      ];

      console.table(resultsTable);

      if (isPass) {
        console.log(`\n🎉 Pipeline latency within SLA (${totalTtfb}ms <= ${options.threshold}ms).\n`);
        resolve({ skipped: false, success: true, exitCode: 0, sttLatency, totalTtfb });
      } else {
        console.error(`\n❌ TTFB latency SLA violated: ${totalTtfb}ms exceeds threshold of ${options.threshold}ms.\n`);
        resolve({ skipped: false, success: false, exitCode: 1, sttLatency, totalTtfb });
      }
    }
  });
}

// Execute CLI
if (process.argv[1] && process.argv[1].endsWith('voice-latency-benchmark.mjs')) {
  const options = parseCliArgs();
  runBenchmark(options)
    .then((result) => {
      process.exit(result.exitCode);
    })
    .catch((err) => {
      console.error('Fatal benchmark error:', err);
      process.exit(1);
    });
}
