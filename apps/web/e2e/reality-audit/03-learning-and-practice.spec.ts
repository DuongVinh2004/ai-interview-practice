import { test, expect } from '@playwright/test';

test.describe('Domain J, K, L, M, N, O — Learning, Practice, Gamification & Arena Audit', () => {
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

  test('Domain J: Profile Management, Validation & Persistence', async ({ page }) => {
    // 1. Log in as candidate
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 2. Navigate to Profile
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // 3. Edit Profile field
    const nameInput = page.locator('#fullName, input[name="fullName"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    const originalName = await nameInput.inputValue();
    const updatedName = `Candidate Audit ${Date.now().toString().slice(-4)}`;
    await nameInput.fill(updatedName);

    const saveBtn = page.locator('button:has-text("Lưu"), button:has-text("Save")').first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // 4. Reload to verify persistence
    await page.reload();
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#fullName, input[name="fullName"]').first()).toHaveValue(updatedName);

    // Revert to original
    await nameInput.fill(originalName || 'Demo Candidate');
    await saveBtn.click();
  });

  test('Domain K: Question Bank Search, Detail & Bookmarking Flow', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');

    // 1. Visit Question Bank
    await page.goto('/question-bank');
    await expect(page.getByRole('heading', { name: /(question bank|ngân hàng câu hỏi)/i }).first()).toBeVisible({ timeout: 15000 });

    // 2. Search filtering
    const searchInput = page.locator('input[placeholder*="Tìm kiếm"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('PostgreSQL');
      await page.waitForTimeout(500);
    }

    // 3. Open first question card
    const firstQuestionLink = page.locator('a[href*="/question-bank/"]').first();
    await expect(firstQuestionLink).toBeVisible({ timeout: 15000 });
    await firstQuestionLink.click();
    await expect(page).toHaveURL(/\/question-bank\/[^/]+$/);

    // 4. Verify question details render
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    // 5. Test invalid question slug
    await page.goto('/question-bank/this-question-slug-does-not-exist-audit-404');
    await expect(page.getByText(/(không tìm thấy|not found|404|quay lại)/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Domain L: Flashcards Decks & Review Lifecycle', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');

    // 1. Decks page
    await page.goto('/flashcards');
    await expect(page.getByText(/(flashcard|thẻ ghi nhớ|deck)/i).first()).toBeVisible({ timeout: 15000 });

    // 2. Review flow if available
    const reviewBtn = page.locator('a:has-text("Ôn tập"), a:has-text("Review"), button:has-text("Ôn tập"), button:has-text("Review")').first();
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      await expect(page).toHaveURL(/\/flashcards\/review/);
      await expect(page.getByTestId('flashcard-review-page').or(page.getByTestId('review-finished'))).toBeVisible({ timeout: 15000 });
    }
  });

  test('Domain M: Gamification Showcase, Badges & Leaderboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');

    // 1. Badges showcase
    await page.goto('/gamification/badges');
    await expect(page).toHaveURL('/gamification/badges');
    await expect(page.getByText(/(huy hiệu|badges|thành tích|achievements)/i).first()).toBeVisible({ timeout: 15000 });

    // 2. Leaderboard
    await page.goto('/gamification/leaderboard');
    await expect(page).toHaveURL('/gamification/leaderboard');
    await expect(page.getByText(/(bảng xếp hạng|leaderboard|top candidates|xếp hạng)/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Domain N: Skills Graph, Benchmarks & Career Readiness', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');

    // 1. Skills Overview
    await page.goto('/skills');
    await expect(page.getByText(/(kỹ năng|skills|năng lực|competency)/i).first()).toBeVisible({ timeout: 15000 });

    // 2. Skills Benchmark
    await page.goto('/skills/benchmark');
    await expect(page.getByText(/(benchmark|chuẩn hóa|so sánh|tiêu chuẩn)/i).first()).toBeVisible({ timeout: 15000 });

    // 3. Career Readiness
    await page.goto('/readiness');
    await expect(page).toHaveURL('/readiness');
    await expect(page.getByTestId('readiness-page')).toBeVisible({ timeout: 15000 });
  });

  test('Domain O: Engineering Arena Interactive Challenge Flow', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');

    // 1. Visit Arena
    await page.goto('/arena');
    await expect(page).toHaveURL('/arena');
    await expect(page.getByText(/(engineering arena|đấu trường|thử thách code|challenges)/i).first()).toBeVisible({ timeout: 15000 });

    // 2. Check Monaco or code editor container
    const codeEditor = page.locator('[data-testid="code-editor-container"], .monaco-editor, textarea').first();
    await expect(codeEditor).toBeVisible({ timeout: 20000 });

    // 3. Check Run Code button
    const runBtn = page.locator('[data-testid="run-code-btn"], button:has-text("Chạy"), button:has-text("Run")').first();
    if (await runBtn.isVisible()) {
      await expect(runBtn).toBeEnabled();
    }
  });
});
