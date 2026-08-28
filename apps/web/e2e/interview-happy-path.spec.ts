import { test, expect } from '@playwright/test';

test.describe('AI Interview Practice Vertical Slice Happy Path', () => {
  test('Candidate logs in, sets up session, answers question, and receives AI evaluation', async ({
    page,
  }) => {
    // 1. Visit login page
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();

    // 2. Sign in with demo candidate account
    await page.fill('#email', 'candidate@example.com');
    await page.fill('#password', 'Candidate@123456');
    await page.click('button[type="submit"]');

    // 3. Land on Dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/(welcome back|chào mừng trở lại)/i)).toBeVisible();

    // 4. Navigate to Setup page
    await page.click(
      'a:has-text("Start New Interview"), a:has-text("Bắt đầu Phỏng vấn Mới"), a[href="/interviews/new"]',
    );
    await expect(page).toHaveURL('/interviews/new');
    await expect(
      page.getByRole('heading', {
        name: /(configure your interview|cấu hình phỏng vấn|thiết lập phỏng vấn)/i,
      }),
    ).toBeVisible();

    // 5. Select technology and start interview
    await page.click('button:has-text("TypeScript")');
    await page.click(
      'button:has-text("Bắt Đầu Phỏng Vấn Ngay"), button:has-text("Begin 5-Question Interview"), button:has-text("Bắt đầu")',
    );

    // 6. Enter Interview Room
    await expect(page).toHaveURL(/\/interviews\/[a-f0-9-]+/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /(câu hỏi|question) 1/i })).toBeVisible({
      timeout: 15000,
    });

    // 7. Wait for Question to be generated and displayed
    await expect(page.locator('#answer-textarea')).toBeVisible({ timeout: 15000 });

    // 8. Type answer and submit
    await page.fill(
      '#answer-textarea',
      'In a production TypeScript application, robust state management requires isolating client state from server cache, enforcing strict typing, and handling runtime API errors gracefully with error boundaries.',
    );
    await page.click('button[type="submit"]');

    // 9. Verify evaluation completes and session advances to Turn 2
    await expect(page.getByRole('heading', { name: /(câu hỏi|question) 2/i })).toBeVisible({
      timeout: 25000,
    });
    await expect(page.getByText(/(lịch sử các lượt trước|past turns)/i)).toBeVisible();

    // 10. Click past turn 1 accordion to inspect evaluation
    await page.click(
      'button:has-text("Câu hỏi 1"), button:has-text("Question 1"), button:has-text("1")',
    );
    await expect(page.getByText(/(độ chính xác kỹ thuật|technical accuracy)/i).first()).toBeVisible(
      { timeout: 15000 },
    );
  });
});
