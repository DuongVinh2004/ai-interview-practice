import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

function generateTotp(base32Secret: string, timestamp = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = base32Secret
    .replace(/=+$/u, '')
    .toUpperCase()
    .split('')
    .map(character => alphabet.indexOf(character).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from(
    (bits.match(/.{8}/gu) || [])
      .map(byte => String.fromCharCode(Number.parseInt(byte, 2)))
      .join(''),
    'binary',
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

test.describe('Comprehensive AI Interview Practice E2E Operations Suite', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error(`[browser pageerror] ${error.message}`));
    page.on('response', response => {
      if (response.status() >= 400) {
        console.error(
          `[browser http ${response.status()}] ${response.request().method()} ${response.url()}`,
        );
      }
    });
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('1. Candidate Auth, Navigation & Core Modules Walkthrough', async ({ page }) => {
    // 1. Visit Login (prepared by beforeEach)
    await expect(page.getByRole('heading', { name: /(sign in|đăng nhập)/i })).toBeVisible();

    // 2. Sign in as Candidate
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');

    // 3. Dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/(welcome back|chào mừng)/i)).toBeVisible();

    // 4. Navigate to Skills Graph & Benchmark
    await page.goto('/skills');
    await expect(page.getByText(/(skill|kỹ năng|năng lực)/i).first()).toBeVisible();

    // 5. Navigate to Career Readiness
    await page.goto('/readiness');
    await expect(page).toHaveURL('/readiness');
    await expect(page.getByTestId('readiness-page')).toBeVisible({ timeout: 15000 });

    // 6. Navigate to Flashcards Decks
    await page.goto('/flashcards');
    await expect(page.getByText(/(flashcard|thẻ ghi nhớ|deck)/i).first()).toBeVisible();

    // 7. Navigate to History
    await page.goto('/history');
    await expect(page.getByText(/(lịch sử|history)/i).first()).toBeVisible();

    // 8. Navigate to Pricing & Billing
    await page.goto('/pricing');
    await expect(page.getByText(/(free|pro|enterprise|pricing|bảng giá)/i).first()).toBeVisible();

    // 9. Navigate to Profile & Settings
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // 10. Navigate to Mentors
    await page.goto('/mentors');
    await expect(page.getByText(/(mentor|cố vấn|chuyên gia)/i).first()).toBeVisible();
  });

  test('2. Admin Operations & Governance Walkthrough', async ({ page }) => {
    // 1. Sign in with Admin credentials
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'Admin@123456');
    const setupResponsePromise = page.waitForResponse(
      response =>
        response.url().endsWith('/auth/mfa/setup') && response.request().method() === 'POST',
    );
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 15000 });
    await expect(page).toHaveURL(/\/profile\?setupMfa=1$/);

    // 2. Complete the mandatory admin MFA enrollment with a real RFC 6238 TOTP.
    const setupResponse = await setupResponsePromise;
    expect(setupResponse.status()).toBe(200);
    const setupBody = await setupResponse.json();
    const secret = (setupBody.data || setupBody).secret as string | undefined;
    expect(secret).toBeTruthy();
    const mfaForm = page.locator('form').filter({ has: page.locator('input[maxlength="6"]') });
    await mfaForm.locator('input[maxlength="6"]').fill(generateTotp(secret!));
    const enableResponse = page.waitForResponse(
      response =>
        response.url().endsWith('/auth/mfa/enable') && response.request().method() === 'POST',
    );
    await mfaForm.locator('button[type="submit"]').click();
    expect((await enableResponse).status()).toBe(200);

    // 3. Admin Users Management (hard reload also verifies the MFA-bound refresh cookie).
    await page.goto('/admin/users');
    await expect(page).toHaveURL('/admin/users');
    await expect(page.getByRole('heading', { name: 'User Administration' })).toBeVisible({
      timeout: 15000,
    });

    // 4. Admin AI Telemetry & Circuit Breaker
    await page.goto('/admin/ai-runs');
    await expect(page).toHaveURL('/admin/ai-runs');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // 5. Admin Prompts Version Management
    await page.goto('/admin/prompts');
    await expect(page).toHaveURL('/admin/prompts');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // 6. Admin Golden Benchmark AI Evaluation Suite
    await page.goto('/admin/ai-eval');
    await expect(page).toHaveURL('/admin/ai-eval');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
  });

  test('3. Setup Interview Modes & Customization', async ({ page }) => {
    // 1. Login
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 2. Go to Setup page
    await page.goto('/interviews/new');
    await expect(page).toHaveURL('/interviews/new');
    await expect(page.getByTestId('interview-setup-page')).toBeVisible({ timeout: 15000 });

    // 3. Select Remediation Mode
    await page.click(
      'button:has-text("Luyện tập Trọng tâm"), button:has-text("Focused Remediation")',
    );
    await expect(
      page.getByText(/(năng lực kỹ thuật trọng tâm|focus competency area)/i),
    ).toBeVisible();

    // 4. Select Sandbox Practice Mode
    await page.click(
      'button:has-text("Thao trường Thử nghiệm"), button:has-text("Quick Sandbox Drill")',
    );
    await expect(page.getByText(/(số lượng câu hỏi|question count)/i)).toBeVisible();

    // 5. Select Live Coding Mode
    await page.click('button:has-text("Live Coding")');

    // 6. Switch to Standard Mode, select tech stack and launch interview
    await page.click(
      'button:has-text("Phỏng vấn Toàn diện"), button:has-text("Full Mock Interview")',
    );
    await page.click('button:has-text("TypeScript")');
    await page.click(
      'button:has-text("Bắt Đầu Phỏng Vấn Ngay"), button:has-text("Begin 5-Question Interview"), button:has-text("Bắt đầu")',
    );

    // 7. Verify Interview Room is active
    await expect(page).toHaveURL(/\/interviews\/[a-f0-9-]+/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /(câu hỏi|question) 1/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('4. Profile Management & Flashcards Review Flow', async ({ page }) => {
    // 1. Login
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 2. Profile Page
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // 3. Save profile changes
    const nameInput = page
      .locator('#fullName, input[name="fullName"], input[value*="Candidate"]')
      .first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Demo Candidate');
      await page.click('button:has-text("Lưu"), button:has-text("Save")');
    }

    // 4. Flashcards Page
    await page.goto('/flashcards');
    await expect(page.getByText(/(flashcard|thẻ ghi nhớ|deck)/i).first()).toBeVisible();

    // 5. Readiness Page
    await page.goto('/readiness');
    await expect(page).toHaveURL('/readiness');
    await expect(page.getByTestId('readiness-page')).toBeVisible({ timeout: 15000 });
  });
});
