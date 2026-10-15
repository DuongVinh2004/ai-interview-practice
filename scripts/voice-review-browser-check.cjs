// Isolated browser fixture: real React room/hook/worklet, synthetic API and STT.
// No account or interview database is accessed or changed.
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const { chromium, expect } = createRequire(path.join(root, 'apps/web/package.json'))(
  '@playwright/test',
);
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  try {
    const context = await browser.newContext({
      permissions: ['microphone'],
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const screenshotRun = Date.now();
    const snapshot = async label => {
      if (!process.argv.includes('--screenshots')) return;
      const directory = path.join(root, 'artifacts');
      if (fs.realpathSync(directory) !== directory || !/^[a-z-]+$/.test(label))
        throw new Error('Unexpected screenshot destination');
      const destination = path.join(directory, `voice-ui-${screenshotRun}-${label}.png`);
      if (fs.existsSync(destination)) throw new Error('Preserving existing screenshot');
      await page.screenshot({ path: destination, fullPage: true, animations: 'disabled' });
      console.log(JSON.stringify({ screenshot: destination }));
    };
    const moduleSource = await (
      await page.request.get(
        'http://localhost:5173/src/components/interview/VoiceInterviewRoom.tsx',
      )
    ).text();
    const dependencyQuery = moduleSource.match(/react\.js(\?v=[^"]+)/)?.[1] || '';
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
      console.error(error.message);
    });
    page.on('console', message => {
      if (message.type() === 'error') console.error(message.text());
    });
    await page.addInitScript(() => {
      window.microphoneStarts = 0;
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (...args) => {
        window.microphoneStarts++;
        return original(...args);
      };
    });
    await page.route('**/api/**', route =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: route.request().url().endsWith('/ticket')
            ? { ticket: 'synthetic-fixture-ticket' }
            : { consented: true },
        }),
      }),
    );
    let socket;
    let recorded = 0;
    await page.routeWebSocket('**/voice?*', ws => {
      socket = ws;
      const send = value => ws.send(JSON.stringify(value));
      ws.onMessage(data => {
        if (typeof data !== 'string') return;
        const message = JSON.parse(data);
        if (message.type === 'voice:connect') send({ type: 'voice:connected' });
        if (message.type === 'voice:recording-start') {
          recorded++;
          send({ type: 'voice:recording-started', recordingId: message.recordingId });
          send({
            type: 'voice:recording-draft',
            recordingId: message.recordingId,
            text: recorded === 1 ? 'Tôi dùng API.' : 'Thêm ví dụ Redis.',
          });
        }
        if (message.type === 'voice:recording-stop') {
          send({
            type: 'voice:recording-stopped',
            recordingId: message.recordingId,
            text: recorded === 1 ? 'Tôi dùng API.' : 'Thêm ví dụ Redis.',
          });
          setTimeout(
            () =>
              send({
                type: 'voice:recording-draft',
                recordingId: message.recordingId,
                text: 'late transcript',
              }),
            100,
          );
        }
      });
    });
    await page.route('**/voice-review-fixture', route =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      await import('/src/voice-review-fixture.js');
    </script></body></html>`,
      }),
    );
    await page.route('**/src/voice-review-fixture.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `
      import React from '/node_modules/.vite/deps/react.js${dependencyQuery}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${dependencyQuery}';
      import {MemoryRouter} from '/node_modules/.vite/deps/react-router-dom.js${dependencyQuery}';
      import {VoiceInterviewRoom} from '/src/components/interview/VoiceInterviewRoom.tsx';
      import '/src/index.css';
      window.sentAnswers = [];
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(VoiceInterviewRoom,{
        interviewId:'browser-fixture',userId:'synthetic-user',turnId:'turn1',turnNumber:1,totalTurns:5,currentQuestion:'Khi thiết kế một API có lưu lượng truy cập lớn, bạn sẽ sử dụng Redis để tối ưu hiệu năng như thế nào? Hãy giải thích cách giữ dữ liệu trong bộ nhớ đệm nhất quán với cơ sở dữ liệu, xử lý race condition khi nhiều yêu cầu cập nhật đồng thời và những đánh đổi của giải pháp bạn lựa chọn.',sessionState:'ACTIVE',
        onRestAnswerSubmit:async (text,turnId) => {window.sentAnswers.push({text,turnId});}
      })));
    `,
      }),
    );
    const open = async () => {
      await page.goto('http://localhost:5173/voice-review-fixture');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="voice-consent-modal"]'),
        undefined,
        { timeout: 10000 },
      );
      await snapshot('welcome');
      await page.getByRole('button', { name: 'Đồng ý và bắt đầu' }).click();
      await expect(page.getByTestId('voice-connection')).toHaveText('Đã kết nối');
    };
    await open();
    await snapshot('desktop');
    if ((await page.evaluate(() => window.microphoneStarts)) !== 0)
      throw new Error('Microphone started automatically');
    await page.getByRole('button', { name: 'Bắt đầu trả lời', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gửi câu trả lời', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Dừng ghi âm', exact: true })).toBeVisible();
    await snapshot('recording');
    await page.getByRole('button', { name: 'Dừng ghi âm', exact: true }).click();
    const answer = page.getByRole('textbox', { name: 'Câu trả lời của bạn' });
    await expect(answer).toBeEditable();
    await answer.fill('Tôi đã sửa API.');
    await page.getByRole('button', { name: 'Nói bổ sung', exact: true }).click();
    await page.getByRole('button', { name: 'Dừng ghi âm', exact: true }).click();
    await expect(answer).toHaveValue('Tôi đã sửa API. Thêm ví dụ Redis.');
    await page.getByRole('button', { name: 'Rời phiên', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await snapshot('leave-dialog');
    await page.getByRole('dialog').getByRole('button', { name: 'Ở lại' }).click();
    await expect(answer).toHaveValue('Tôi đã sửa API. Thêm ví dụ Redis.');
    if ((await page.evaluate(() => window.sentAnswers)).length)
      throw new Error('Recognition submitted an answer automatically');
    socket.send(
      JSON.stringify({
        type: 'voice:playback-error',
        message: 'Không thể phát câu hỏi. Bạn vẫn có thể ghi âm hoặc nhập câu trả lời.',
      }),
    );
    await expect(page.getByTestId('voice-connection')).toHaveText('Đã kết nối');
    await expect(answer).toBeEditable();
    await snapshot('playback-error');
    await socket.close();
    await expect(page.getByTestId('voice-fallback-banner')).toBeVisible();
    await snapshot('offline');
    await page.reload();
    await page.getByRole('button', { name: 'Đồng ý và bắt đầu' }).click();
    await expect(answer).toHaveValue('Tôi đã sửa API. Thêm ví dụ Redis.');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
        throw new Error(`Horizontal overflow at ${width}px`);
      await snapshot(width === 390 ? 'mobile' : 'small-mobile');
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await snapshot('dark');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.getByRole('button', { name: 'Gửi câu trả lời', exact: true }).click();
    await expect(page.getByTestId('voice-answer-accepted')).toBeVisible();
    await expect(answer).toHaveCount(0);
    await snapshot('accepted');
    const submitted = await page.evaluate(() => window.sentAnswers);
    if (
      submitted.length !== 1 ||
      submitted[0].turnId !== 'turn1' ||
      submitted[0].text !== 'Tôi đã sửa API. Thêm ví dụ Redis.'
    )
      throw new Error('Incorrect final answer');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(
      JSON.stringify({
        passed: true,
        checks: [
          'microphone off by default',
          'record-stop-edit-append',
          'no auto submit',
          'send disabled during recording',
          'cancel leave preserves draft',
          'late transcript isolation',
          'TTS error isolation',
          'reload restores draft',
          'exact edited answer submitted once',
        ],
      }),
    );
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
