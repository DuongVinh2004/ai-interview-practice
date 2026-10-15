import { writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env variables
const envPath = resolve(process.cwd(), '.env');
const env = {};
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
}

const NINEROUTER_URL = env.NINEROUTER_URL || 'http://localhost:20128';
const NINEROUTER_KEY = env.NINEROUTER_KEY || '';
const TTS_MODEL = env.NINEROUTER_TTS_MODEL || 'edge-tts/vi-VN-HoaiMyNeural';
const TEST_TEXT = 'Xin chào, đây là bài kiểm tra tính năng chuyển văn bản thành giọng nói từ 9Router trên nền tảng AI Interview Practice.';

console.log('=== TEST 1: Text-to-Speech (9Router Edge-TTS) ===');
console.log(`URL: ${NINEROUTER_URL}/v1/audio/speech`);
console.log(`Model: ${TTS_MODEL}`);
console.log(`Text: "${TEST_TEXT}"\n`);

try {
  const startTime = Date.now();
  const ttsRes = await fetch(`${NINEROUTER_URL}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NINEROUTER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: TEST_TEXT
    })
  });

  if (!ttsRes.ok) {
    console.error('TTS Thất bại [%s]: %s', ttsRes.status, await ttsRes.text());
  } else {
    const audioBuf = await ttsRes.arrayBuffer();
    const durationMs = Date.now() - startTime;
    const outputPath = resolve(process.cwd(), 'output-speech.mp3');
    await writeFile(outputPath, Buffer.from(audioBuf));

    console.log(`TTS Thành công!`);
    console.log(`- Dung lượng: ${audioBuf.byteLength} bytes`);
    console.log(`- Thời gian phản hồi: ${durationMs}ms`);
    console.log(`- File âm thanh đã lưu tại: ${outputPath}\n`);

    console.log('=== TEST 2: Speech-to-Text ===');
    console.log('Đang thử transcribe file vừa tạo qua 9Router STT...');
    const form = new FormData();
    form.append('model', env.NINEROUTER_STT_MODEL || 'groq/whisper-large-v3-turbo');
    form.append('file', new Blob([audioBuf], { type: 'audio/mp3' }), 'speech.mp3');
    form.append('language', 'vi');

    const sttRes = await fetch(`${NINEROUTER_URL}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${NINEROUTER_KEY}` },
      body: form
    });

    if (sttRes.ok) {
      const sttData = await sttRes.json();
      console.log('9Router STT Thành công:', sttData);
    } else {
      const err = await sttRes.text();
      console.log(`9Router STT: Chưa có provider STT trong 9Router Dashboard (${err})`);
      
      // Fallback: Test STT với Deepgram hoặc OpenAI có sẵn trong .env
      if (env.OPENAI_API_KEY) {
        console.log('\nThử giải mã STT trực tiếp bằng OpenAI Whisper từ key trong .env...');
        const openaiForm = new FormData();
        openaiForm.append('model', 'whisper-1');
        openaiForm.append('file', new Blob([audioBuf], { type: 'audio/mp3' }), 'speech.mp3');
        openaiForm.append('language', 'vi');

        const oaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
          body: openaiForm
        });
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          console.log(`OpenAI STT Thành công!`);
          console.log(`- Nội dung nhận diện: "${oaiData.text}"`);
        } else {
          console.log('OpenAI STT:', await oaiRes.text());
        }
      }
    }
  }
} catch (err) {
  console.error('Lỗi khi chạy test:', err.message);
}
