import { test, expect } from '@playwright/test';

test.describe('Comprehensive AI Interview Practice E2E Operations Suite', () => {
  test('1. Candidate Auth, Navigation & Core Modules Walkthrough', async ({ page }) => {
    // 1. Visit Login
    await page.goto('/login');
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
    await expect(page.getByText(/(readiness|sẵn sàng)/i).first()).toBeVisible();

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
    await expect(page.getByText(/(hồ sơ|profile|mục tiêu)/i).first()).toBeVisible();

    // 10. Navigate to Mentors
    await page.goto('/mentors');
    await expect(page.getByText(/(mentor|cố vấn|chuyên gia)/i).first()).toBeVisible();
  });

  test('2. Admin Operations & Governance Walkthrough', async ({ page }) => {
    // 1. Visit Login
    await page.goto('/login');

    // 2. Sign in with Admin credentials
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/(\/|\/profile\?setupMfa=1)/);

    // 3. Admin Users Management
    await page.goto('/admin/users');
    await expect(
      page.getByText(/(quản trị người dùng|user administration|admin)/i).first(),
    ).toBeVisible();

    // 4. Admin AI Telemetry & Circuit Breaker
    await page.goto('/admin/ai-runs');
    await expect(
      page.getByText(/(giám sát ai|ai orchestrator telemetry|circuit breaker)/i).first(),
    ).toBeVisible();

    // 5. Admin Prompts Version Management
    await page.goto('/admin/prompts');
    await expect(
      page.getByText(/(phiên bản prompt|prompt version|templates)/i).first(),
    ).toBeVisible();

    // 6. Admin Golden Benchmark AI Evaluation Suite
    await page.goto('/admin/ai-eval');
    await expect(page.getByText(/(eval|kiểm thử hồi quy|golden benchmark)/i).first()).toBeVisible();
  });

  test('3. Setup Interview Modes & Customization', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 2. Go to Setup page
    await page.goto('/interviews/new');
    await expect(
      page.getByRole('heading', {
        name: /(configure your interview|cấu hình phỏng vấn|thiết lập phỏng vấn)/i,
      }),
    ).toBeVisible();

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
    await page.click('button:has-text("TypeScript"), button:has-text("React")');
    await page.click('button:has-text("Begin 5-Question Interview"), button:has-text("Bắt đầu")');

    // 7. Verify Interview Room is active
    await expect(page).toHaveURL(/\/interviews\/[a-f0-9-]+/);
    await expect(page.getByRole('heading', { name: /(câu hỏi|question) 1/i })).toBeVisible();
  });

  test('4. Profile Management & Flashcards Review Flow', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 2. Profile Page
    await page.goto('/profile');
    await expect(
      page.getByRole('heading', { name: /(hồ sơ|profile|mục tiêu)/i }).first(),
    ).toBeVisible();

    // 3. Save profile changes
    await page.fill(
      'input[value*="Candidate"], input#fullName, input[name="fullName"]',
      'Demo Candidate',
    );
    await page.click('button:has-text("Lưu Thông tin"), button:has-text("Save Profile")');
    await expect(
      page.getByText(/(cập nhật hồ sơ thành công|profile updated successfully)/i),
    ).toBeVisible({ timeout: 10000 });

    // 4. Flashcards Page
    await page.goto('/flashcards');
    await expect(page.getByText(/(flashcard|thẻ ghi nhớ|deck)/i).first()).toBeVisible();

    // 5. Readiness Page
    await page.goto('/readiness');
    await expect(
      page.getByText(/(mức độ sẵn sàng|readiness score|overall readiness)/i).first(),
    ).toBeVisible();
  });
});
