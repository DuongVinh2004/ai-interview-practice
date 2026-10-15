import { test, expect } from '@playwright/test';

test.describe('Domain A, B, C — Public Routes, Authentication & Registration Audit', () => {
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

  test('Domain A: Public Routes Integrity & Safe Failure Modes', async ({ page }) => {
    // 1. Unauthenticated root redirect
    const rootRes = await page.goto('/');
    expect(rootRes?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/(login)?$/);

    // 2. Login Page
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /(sign in|đăng nhập)/i }).first()).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // 3. Register Page
    await page.goto('/register');
    await expect(
      page.getByRole('heading', { name: /(sign up|tạo tài khoản|đăng ký)/i }).first(),
    ).toBeVisible();
    await expect(page.locator('#fullName')).toBeVisible();

    // 4. Pricing Page
    await page.goto('/pricing');
    await expect(
      page.getByRole('heading', { name: /(pricing|bảng giá|gói)/i }).first(),
    ).toBeVisible();
    await expect(page.getByText(/(free|pro|enterprise)/i).first()).toBeVisible();

    // 5. Question Bank Landing
    await page.goto('/question-bank');
    await expect(
      page.getByRole('heading', { name: /(question bank|ngân hàng câu hỏi)/i }).first(),
    ).toBeVisible();

    // 6. Safe 404 Route Catch-All
    await page.goto('/this-is-a-non-existent-route-for-audit-404');
    await expect(page.getByText(/(404|không tìm thấy|not found)/i).first()).toBeVisible();

    // 7. Safe 403 Forbidden Page
    await page.goto('/403');
    await expect(
      page.getByText(/(403|truy cập bị từ chối|forbidden|access denied)/i).first(),
    ).toBeVisible();

    // 8. Public Share Token (Invalid)
    await page.goto('/share/invalid-audit-token-nonexistent');
    await expect(
      page.getByText(/(không tìm thấy|not found|hết hạn|invalid|lỗi)/i).first(),
    ).toBeVisible();

    // 9. Certificate Verification (Invalid / Non-UUID)
    await page.goto('/verify/invalid-audit-cert-nonexistent');
    await expect(
      page
        .getByText(
          /(Verification Issue|Certificate Expired|không hợp lệ|invalid|không tìm thấy|not found)/i,
        )
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('Domain B: Authentication Flow, Session Lifecycle & Invalidation', async ({ page }) => {
    // 1. Invalid Login - wrong password
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'WrongPassword!999');
    await page.click('button[type="submit"]');
    await expect(
      page.locator('[role="alert"], .text-red-600, .text-rose-600, .bg-red-50').first(),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/login/);

    // 2. Valid Login with candidate account
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 15000 });
    await expect(page.getByText(/(welcome back|chào mừng)/i)).toBeVisible();

    // 3. Reload Session Persistence (Verify HttpOnly refresh restoration)
    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/(welcome back|chào mừng)/i)).toBeVisible();

    // 4. Protected Route Navigation while authenticated
    await page.goto('/interviews/new');
    await expect(page).toHaveURL('/interviews/new');
    await expect(page.getByTestId('interview-setup-page')).toBeVisible({ timeout: 15000 });

    // 5. Logout Flow
    const userMenuBtn = page.locator('button[aria-label="User Profile Menu"]').first();
    await expect(userMenuBtn).toBeVisible({ timeout: 10000 });
    await userMenuBtn.click();
    const logoutBtn = page
      .locator('button:has-text("Đăng xuất"), button:has-text("Sign Out")')
      .first();
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // 6. Verify Protected Route Invalidation post-logout
    await page.goto('/interviews/new');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Domain C: Registration Negative Cases & Fresh User Onboarding', async ({ page }) => {
    await page.goto('/register');

    // 1. Validation error on empty submit
    await page.click('button[type="submit"]');
    await expect(page.locator('#email')).toBeVisible();

    // 2. Duplicate registration attempt
    await page.fill('#fullName', 'Candidate Duplicate');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'SecurePass@123');
    await page.click('button[type="submit"]');
    await expect(
      page.locator('[role="alert"], .bg-red-50, .text-red-600, .text-rose-600').first(),
    ).toBeVisible({
      timeout: 10000,
    });

    // 3. Valid dynamic candidate registration with audit-specific timestamp
    const timestamp = Date.now().toString().slice(-6);
    const uniqueEmail = `e2e_${timestamp}@example.com`;
    const fullName = `E2E Candidate ${timestamp}`;

    await page.fill('#fullName', fullName);
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', 'SecurePass@123');
    await page.click('button[type="submit"]');

    // Expected redirect to setup or dashboard
    await expect(page).toHaveURL(/\/(interviews\/new)?$/, { timeout: 15000 });

    // 4. Verify profile initialized & persistent after reload
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });
    await expect(
      page
        .locator(`text="${fullName}"`)
        .or(page.locator(`input[value="${fullName}"]`))
        .first(),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });
  });
});
