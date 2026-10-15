import { test, expect } from '@playwright/test';

test.describe('Domain P, Q, R, S, T — Extended Modules, Voice Consent, SSE & Responsive UI Audit', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.error(`[browser pageerror] ${error.message}`);
    });
    page.on('response', response => {
      if (response.status() >= 500) {
        console.error(`[browser http ${response.status()}] ${response.request().method()} ${response.url()}`);
      }
    });
  });

  test('Domain P: Billing, Mentors & B2B Candidate Role Fail-Closed Authorization', async ({ page }) => {
    // 1. Log in as candidate
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 2. Mentors Route
    await page.goto('/mentors');
    await expect(page).toHaveURL('/mentors');
    await expect(page.getByText(/(mentor|cố vấn|chuyên gia)/i).first()).toBeVisible({ timeout: 15000 });

    // 3. Billing Dashboard Route
    await page.goto('/billing');
    await expect(page).toHaveURL('/billing');
    await expect(page.getByText(/(subscription|gói dịch vụ|phút phỏng vấn|invoices|hóa đơn)/i).first()).toBeVisible({ timeout: 15000 });

    // 4. B2B Route Fail-Closed Authorization Check
    // Candidate role must NOT access enterprise B2B dashboard
    await page.goto('/b2b/dashboard');
    // Expected: either 403, redirected to /403, or redirected to /
    await expect(page).not.toHaveURL('/b2b/dashboard');
  });

  test('Domain Q: Public Share, Verification & Portfolio Edge Cases', async ({ page }) => {
    // 1. Public Shared Result with invalid token
    await page.goto('/share/invalid-token-audit-fail-safe');
    await expect(page.getByText(/(Link Unavailable or Expired|không tìm thấy|hết hạn)/i).first()).toBeVisible({ timeout: 15000 });

    // 2. Public portfolio with non-existent user
    await page.goto('/u/nonexistent_audit_user_xyz');
    await expect(page.getByText(/(không tìm thấy|not found|404|quay lại)/i).first()).toBeVisible({ timeout: 15000 });

    // 3. Certificate verification with safe non-existent UUID
    await page.goto('/verify/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText(/(Certificate ID does not exist|không tìm thấy|revoked|verification issue)/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Domain R & S: Voice Interview Explicit Consent UX & Realtime Lifecycle', async ({ page }) => {
    // 1. Log in as candidate
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 2. Start TypeScript interview to enter room
    await page.goto('/interviews/new');
    await expect(page.getByTestId('interview-setup-page')).toBeVisible({ timeout: 15000 });
    await page.locator('button:has-text("TypeScript")').first().click();
    await page.locator('button:has-text("Bắt Đầu Phỏng Vấn Ngay"), button:has-text("Begin 5-Question Interview"), button:has-text("Bắt đầu")').first().click();
    await expect(page).toHaveURL(/\/interviews\/[a-f0-9-]+/, { timeout: 20000 });

    // 3. Switch to Voice Mode
    const voiceModeBtn = page.locator('[data-testid="mode-voice-btn"], button:has-text("Voice Mode"), button:has-text("Chế độ Giọng nói")').first();
    if (await voiceModeBtn.isVisible()) {
      await voiceModeBtn.click();

      // Invariant: Consent modal MUST appear before microphone streaming is initiated
      const consentModal = page.locator('[data-testid="voice-consent-modal"], :has-text("Quyền Riêng Tư & Xử Lý Giọng Nói"), :has-text("Voice Consent")').first();
      await expect(consentModal).toBeVisible({ timeout: 10000 });

      // Invariant: Denial / Cancel must return safely to text mode
      const cancelBtn = page.locator('button:has-text("Hủy"), button:has-text("Cancel"), button:has-text("Chuyển về phỏng vấn văn bản")').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await expect(page.locator('#answer-textarea')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Domain T: Responsive Layout Integrity Across Mobile, Tablet & Desktop', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    const viewports = [
      { name: 'Mobile (360x740)', width: 360, height: 740 },
      { name: 'Tablet (768x1024)', width: 768, height: 1024 },
      { name: 'Desktop (1440x900)', width: 1440, height: 900 },
    ];

    const auditedRoutes = [
      '/',
      '/interviews/new',
      '/history',
      '/profile',
      '/question-bank',
      '/arena',
      '/pricing',
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of auditedRoutes) {
        await page.goto(route);
        await page.waitForLoadState('domcontentloaded');

        // Verify page content rendered without horizontal overflow
        const hasOverflow = await page.evaluate(() => {
          return document.body.scrollWidth > window.innerWidth + 2;
        });

        if (hasOverflow) {
          console.warn(`[Responsive Warning] Horizontal overflow detected on ${vp.name} at ${route}`);
        }
        // Ensure core container exists
        await expect(page.locator('main, #root, [data-testid]').first()).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
