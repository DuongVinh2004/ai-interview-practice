import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PushPermissionBanner } from '../PushPermissionBanner';
import { apiClient } from '../../../lib/api-client';

vi.mock('../../../lib/api-client', () => ({
  apiClient: Object.assign(vi.fn().mockResolvedValue({ success: true }), {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn(),
  }),
}));

describe('PushPermissionBanner Component (Task 2.4)', () => {
  const originalNotification = window.Notification;
  const originalLocalStorage = window.localStorage;

  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        }),
      },
      writable: true,
      configurable: true,
    });

    // Default Notification permission
    (window as any).Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };
  });

  afterEach(() => {
    (window as any).Notification = originalNotification;
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('renders banner when Notification.permission is "default" and not dismissed', () => {
    render(<PushPermissionBanner />);

    expect(screen.getByText(/bật thông báo/i)).toBeInTheDocument();
    expect(screen.getByText(/để sau/i)).toBeInTheDocument();
  });

  it('does NOT render banner when Notification.permission is "granted"', () => {
    (window as any).Notification.permission = 'granted';
    render(<PushPermissionBanner />);

    expect(screen.queryByText(/bật thông báo/i)).not.toBeInTheDocument();
  });

  it('does NOT render banner when Notification.permission is "denied"', () => {
    (window as any).Notification.permission = 'denied';
    render(<PushPermissionBanner />);

    expect(screen.queryByText(/bật thông báo/i)).not.toBeInTheDocument();
  });

  it('dismisses banner and sets 7-day timestamp in localStorage when "Để sau" is clicked', () => {
    render(<PushPermissionBanner />);

    const laterButton = screen.getByText(/để sau/i);
    fireEvent.click(laterButton);

    expect(screen.queryByText(/bật thông báo/i)).not.toBeInTheDocument();
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('dismissed'),
      expect.any(String),
    );

    // Re-render should not show banner within 7 days
    const { container } = render(<PushPermissionBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('calls Notification.requestPermission() and sends subscription to server when "Bật thông báo" is clicked', async () => {
    // Mock serviceWorker & PushManager
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: vi.fn().mockResolvedValue({
              toJSON: () => ({
                endpoint: 'https://push.example.com/sub/123',
                keys: { p256dh: 'key_p256dh', auth: 'key_auth' },
              }),
            }),
          },
        }),
      },
      writable: true,
      configurable: true,
    });

    render(<PushPermissionBanner />);

    const enableButton = screen.getByRole('button', { name: /bật thông báo/i });
    fireEvent.click(enableButton);

    expect((window as any).Notification.requestPermission).toHaveBeenCalled();

    await waitFor(() => {
      // Expect API call to /notifications/subscribe or /notifications/push/subscribe
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/notifications\/(push\/)?subscribe/),
        expect.objectContaining({
          endpoint: expect.any(String),
        }),
      );
    });

    // Banner should be hidden after subscription
    await waitFor(() => {
      expect(screen.queryByText(/để sau/i)).not.toBeInTheDocument();
    });
  });
});
