import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '../components/layout/AppLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('AppLayout PushPermissionBanner Integration (Task 2.4)', () => {
  beforeEach(() => {
    (window as any).Notification = {
      permission: 'default',
      requestPermission: vi.fn(),
    };
    let store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          store = {};
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders PushPermissionBanner below Navbar in standard layout', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const banner = screen.getByRole('region', {
      name: /Push Notification Permission Banner/i,
    });
    expect(banner).toBeInTheDocument();

    const mainContent = document.getElementById('main-content');
    expect(mainContent).toBeInTheDocument();

    // Banner should precede main content in DOM order
    expect(
      banner.compareDocumentPosition(mainContent!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
