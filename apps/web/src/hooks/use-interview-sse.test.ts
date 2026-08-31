import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInterviewSse } from './use-interview-sse';

const getAuthState = vi.hoisted(() => vi.fn());
const apiClientMock = vi.hoisted(() => vi.fn());

vi.mock('../stores/auth.store', () => ({
  useAuthStore: { getState: getAuthState },
}));

vi.mock('../lib/api-client', () => ({
  apiClient: apiClientMock,
}));

function closedResponse() {
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      }),
    },
  } as unknown as Response;
}

async function flushStream() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useInterviewSse', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    getAuthState.mockReset();
    apiClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves a fresh access token on reconnect without adding query credentials', async () => {
    fetchMock.mockResolvedValueOnce(closedResponse()).mockResolvedValueOnce(closedResponse());
    getAuthState
      .mockReturnValueOnce({ accessToken: 'initial-token' })
      .mockReturnValueOnce({ accessToken: 'refreshed-token' });

    const { unmount } = renderHook(() =>
      useInterviewSse({ sessionId: 'session-id', enabled: true }),
    );
    await flushStream();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/interviews\/session-id\/events$/);
    expect(fetchMock.mock.calls[0][0]).not.toContain('?');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer initial-token');

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/v1\/interviews\/session-id\/events$/);
    expect(fetchMock.mock.calls[1][0]).not.toContain('?');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer refreshed-token');
    expect(getAuthState).toHaveBeenCalledTimes(2);

    unmount();
  });

  it('stops bounded reconnect attempts and retains polling fallback', async () => {
    fetchMock.mockRejectedValue(new Error('connection failed'));
    getAuthState.mockReturnValue({ accessToken: null });

    const { unmount, result } = renderHook(() =>
      useInterviewSse({ sessionId: 'session-id', enabled: true }),
    );
    await flushStream();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.current.usingFallbackPolling).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(apiClientMock).toHaveBeenCalledWith('/interviews/session-id/status');

    unmount();
  });
});
