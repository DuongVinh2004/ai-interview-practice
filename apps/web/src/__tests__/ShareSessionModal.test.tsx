import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShareSessionModal } from '../components/share/ShareSessionModal';

describe('ShareSessionModal Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/shares') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                data: {
                  id: 'share-1',
                  sessionId: 'session-123',
                  token: 'test-crypto-token-abc',
                  shareUrl: '/share/test-crypto-token-abc',
                  isRevoked: false,
                  isAnonymized: false,
                  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
                  viewCount: 0,
                  createdAt: new Date().toISOString(),
                  mentorFeedback: [],
                },
              }),
            ),
        });
      }

      // Default GET /shares
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: [
                {
                  id: 'share-1',
                  sessionId: 'session-123',
                  token: 'test-crypto-token-abc',
                  shareUrl: '/share/test-crypto-token-abc',
                  isRevoked: false,
                  isAnonymized: false,
                  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
                  viewCount: 3,
                  createdAt: new Date().toISOString(),
                  mentorFeedback: [],
                },
              ],
            }),
          ),
      });
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders modal when open with share link generation options', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ShareSessionModal sessionId="session-123" isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Share with Mentor|Chia sẻ cho Mentor/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Share Link|Tạo Liên kết Chia sẻ/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/\/share\/test-crypto.../i)).toBeInTheDocument();
    });
  });

  it('copies share link to clipboard on click', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ShareSessionModal sessionId="session-123" isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('/share/test-crypto-token-abc'),
    );
  });
});
