// Run from the repository root. Creates a new preview without overwriting any artifact.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = fs.realpathSync(path.resolve(__dirname, '..'));
const apiRoot = path.join(root, 'apps', 'api');
const apiRequire = createRequire(path.join(apiRoot, 'package.json'));
const webRequire = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const destination = path.join(root, 'artifacts', 'voice-pronunciation-preview.wav');
if (fs.existsSync(destination)) throw new Error('Preview already exists; preserving it.');
if (fs.realpathSync(path.dirname(destination)) !== path.join(root, 'artifacts'))
  throw new Error('Unexpected output target');
process.chdir(apiRoot);
apiRequire('ts-node').register({
  project: path.join(apiRoot, 'tsconfig.json'),
  transpileOnly: true,
});
const { Test } = apiRequire('@nestjs/testing');
const { ConfigModule, ConfigService } = apiRequire('@nestjs/config');
const { validateEnv } = require(
  path.join(apiRoot, 'src/modules/platform/config/env.validation.ts'),
);
const { aiConfig, voiceConfig } = require(
  path.join(apiRoot, 'src/modules/platform/config/configuration.ts'),
);
const { ElevenLabsTtsProvider } = require(
  path.join(apiRoot, 'src/modules/voice-gateway/providers/elevenlabs-tts.provider.ts'),
);

(async () => {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        envFilePath: ['.env', 'apps/api/.env', '../../.env'],
        validate: validateEnv,
        load: [aiConfig, voiceConfig],
      }),
    ],
  }).compile();
  let browser;
  try {
    const provider = new ElevenLabsTtsProvider(module.get(ConfigService));
    const session = provider.createStreamingSession(undefined, 'vi');
    if (session.codec !== 'mp3') throw new Error('Expected configured Vietnamese router');
    const chunks = [];
    try {
      const done = new Promise((resolve, reject) =>
        session.audioStream.subscribe({
          next: chunk => chunks.push(Array.from(chunk)),
          complete: resolve,
          error: reject,
        }),
      );
      session.sendText(
        'Bạn sẽ bảo vệ API bằng JWT như thế nào? Hãy giải thích race condition khi sử dụng Redis.',
      );
      session.flush();
      await done;
    } finally {
      session.close();
    }
    browser = await webRequire('@playwright/test').chromium.launch({ headless: true });
    const page = await browser.newPage();
    // Validate every actual MP3 segment in Chromium, then export continuous PCM.
    const samples = await page.evaluate(async buffers => {
      const context = new AudioContext({ sampleRate: 24000 });
      const result = [];
      try {
        for (const bytes of buffers) {
          const audio = await context.decodeAudioData(new Uint8Array(bytes).buffer);
          result.push(...Array.from(audio.getChannelData(0)));
        }
      } finally {
        await context.close();
      }
      return result;
    }, chunks);
    const wav = Buffer.alloc(44 + samples.length * 2);
    wav.write('RIFF');
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(24000, 24);
    wav.writeUInt32LE(48000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((sample, index) =>
      wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2),
    );
    fs.writeFileSync(destination, wav, { flag: 'wx' });
    console.log(
      JSON.stringify({
        file: destination,
        segments: chunks.length,
        durationSeconds: samples.length / 24000,
      }),
    );
  } finally {
    await browser?.close();
    await module.close();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
