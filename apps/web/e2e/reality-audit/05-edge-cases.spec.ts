import { test, expect } from '@playwright/test';

test.describe('Section 8 — Edge Cases, Malformed UUIDs, Rapid Clicks & Security Guardrails', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.error(`[browser pageerror] ${error.message}`);
    });
    page.on('response', response => {
      if (response.status() >= 500) {
        console.error(
          `[browser http ${response.status()}] ${response.request().method()} ${response.url()}`,
        );
      }
    });
  });

  test('Edge Case 1: Malformed & Non-Existent UUID Session Handling', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 1. Completely malformed UUID in interview room
    await page.goto('/interviews/not-a-valid-uuid-format');
    // Invariant: Must not crash the browser, should display not found or redirect
    await expect(
      page.getByText(/(không tìm thấy|not found|404|quay lại|lỗi)/i).first(),
    ).toBeVisible({ timeout: 15000 });

    // 2. Non-existent but valid UUID
    await page.goto('/interviews/00000000-0000-0000-0000-000000000000');
    await expect(
      page.getByText(/(không tìm thấy|not found|404|quay lại|lỗi)/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('Edge Case 2: Protected Route Invalidation for Anonymous Users', async ({ page }) => {
    // Ensure cleared storage
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const protectedPaths = [
      '/interviews/new',
      '/history',
      '/profile',
      '/readiness',
      '/skills',
      '/arena',
      '/billing',
    ];

    for (const path of protectedPaths) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });

  test('Edge Case 3: XSS & Special Characters Input Sanitization', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // Go to setup and launch session
    await page.goto('/interviews/new');
    await expect(page.getByTestId('interview-setup-page')).toBeVisible({ timeout: 15000 });
    await page.locator('button:has-text("TypeScript")').first().click();
    await page
      .locator(
        'button:has-text("Bắt Đầu Phỏng Vấn Ngay"), button:has-text("Begin 5-Question Interview"), button:has-text("Bắt đầu")',
      )
      .first()
      .click();
    await expect(page).toHaveURL(/\/interviews\/[a-f0-9-]+/, { timeout: 20000 });

    // Submit XSS payload as answer
    const xssPayload =
      '<script>alert("xss")</script><img src="x" onerror="alert(1)">\' OR \'1\'=\'1';
    await expect(page.locator('#answer-textarea')).toBeVisible({ timeout: 25000 });
    await page.fill('#answer-textarea', xssPayload);

    // Track dialogs: no alert should trigger
    let dialogTriggered = false;
    page.on('dialog', dialog => {
      dialogTriggered = true;
      dialog.dismiss();
    });

    await page.click('button[type="submit"]');
    await expect(
      page
        .getByText(/(đánh giá chi tiết|feedback|tổng kết|strengths|rubric|điểm|kết quả)/i)
        .first(),
    ).toBeVisible({ timeout: 25000 });
    expect(dialogTriggered).toBe(false);
  });
});
