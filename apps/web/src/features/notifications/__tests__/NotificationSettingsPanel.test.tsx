import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationSettingsPanel } from '../NotificationSettingsPanel';
import { apiClient } from '../../../lib/api-client';

vi.mock('../../../lib/api-client', () => ({
  apiClient: Object.assign(
    vi.fn().mockImplementation((_endpoint: string, opts?: any) => {
      if (opts?.method === 'PATCH' || opts?.method === 'PUT') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({
        dailyReminder: true,
        streakWarning: true,
        newFeatures: false,
        reminderTime: '19:00',
      });
    }),
    {
      get: vi.fn().mockResolvedValue({
        data: {
          dailyReminder: true,
          streakWarning: true,
          newFeatures: false,
          reminderTime: '19:00',
        },
      }),
      patch: vi.fn().mockResolvedValue({ data: { success: true } }),
      put: vi.fn().mockResolvedValue({ data: { success: true } }),
      post: vi.fn().mockResolvedValue({ data: { success: true } }),
      delete: vi.fn(),
    },
  ),
}));

describe('NotificationSettingsPanel Component (Task 2.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 3 toggles and reminder time dropdown', async () => {
    render(<NotificationSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/nhắc nhở hàng ngày|daily reminder/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/cảnh báo chuỗi streak|streak warning/i)).toBeInTheDocument();
    expect(screen.getByText(/tính năng mới|new features/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/giờ nhắc|reminder hour|reminder time/i)).toBeInTheDocument();
  });

  it('has reminder hour dropdown options from 7:00 to 22:00 with default 19:00', async () => {
    render(<NotificationSettingsPanel />);

    const select = (await screen.findByLabelText(
      /giờ nhắc|reminder hour|reminder time/i,
    )) as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const options = Array.from(select.options).map(opt => opt.value);
    expect(options).toContain('07:00');
    expect(options).toContain('19:00');
    expect(options).toContain('22:00');
    expect(select.value).toBe('19:00');
  });

  it('calls PATCH /notifications/preferences when toggling daily reminder', async () => {
    render(<NotificationSettingsPanel />);

    const dailyToggle = screen.getByLabelText(/nhắc nhở hàng ngày|daily reminder/i);
    fireEvent.click(dailyToggle);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/notifications/preferences',
        expect.objectContaining({
          dailyReminder: expect.any(Boolean),
        }),
      );
    });
  });

  it('calls PATCH /notifications/preferences when changing reminder time', async () => {
    render(<NotificationSettingsPanel />);

    const select = screen.getByLabelText(/giờ nhắc|reminder hour|reminder time/i);
    fireEvent.change(select, { target: { value: '20:00' } });

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/notifications/preferences',
        expect.objectContaining({
          reminderTime: '20:00',
        }),
      );
    });
  });
});
