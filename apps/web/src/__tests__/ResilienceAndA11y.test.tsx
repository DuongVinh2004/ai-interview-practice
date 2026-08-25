import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { OfflineBanner } from '../components/common/OfflineBanner';
import { NotFoundPage } from '../features/error/NotFoundPage';
import { ForbiddenPage } from '../features/error/ForbiddenPage';
import { useI18nStore } from '../stores/i18n.store';

function BuggyComponent(): JSX.Element {
  throw new Error('Simulated runtime rendering error');
}

describe('Resilience & Accessibility (Phase 6)', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('ErrorBoundary catches errors and displays recovery options', () => {
    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText(/Đã xảy ra lỗi không mong muốn|An unexpected error occurred/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Simulated runtime rendering error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải lại trang|Reload/i })).toBeInTheDocument();
  });

  it('NotFoundPage renders 404 badge and navigation CTAs', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Error 404/i)).toBeInTheDocument();
    expect(screen.getByText(/Trang không tồn tại|Page Not Found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Về Trang chủ|Return Home/i })).toBeInTheDocument();
  });

  it('ForbiddenPage renders 403 badge and upgrade plans CTA', () => {
    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Error 403/i)).toBeInTheDocument();
    expect(screen.getByText(/Không có quyền truy cập|Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem Gói Nâng cấp|View Plans/i })).toBeInTheDocument();
  });

  it('OfflineBanner updates visibility on online/offline events', () => {
    const { container } = render(<OfflineBanner />);

    // Initially online, nothing rendered
    expect(container.firstChild).toBeNull();

    // Trigger offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(
      screen.getByText(/Mất kết nối mạng Internet|You are currently offline/i),
    ).toBeInTheDocument();

    // Trigger online event
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(
      screen.queryByText(/Mất kết nối mạng Internet|You are currently offline/i),
    ).not.toBeInTheDocument();
  });

  it('Locale store allows dynamic switching between vi and en', () => {
    const { setLanguage } = useI18nStore.getState();

    act(() => {
      setLanguage('en');
    });
    expect(useI18nStore.getState().language).toBe('en');

    act(() => {
      setLanguage('vi');
    });
    expect(useI18nStore.getState().language).toBe('vi');
  });
});
