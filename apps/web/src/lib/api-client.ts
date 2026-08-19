import { ApiErrorResponse, ErrorCode } from '@ai-interview/contracts';
import { useAuthStore } from '../stores/auth.store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly status: number,
    public readonly errors?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  skipAuth?: boolean;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { idempotencyKey, skipAuth, headers = {}, ...customConfig } = options;
  const authStore = useAuthStore.getState();

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth && authStore.accessToken) {
    reqHeaders['Authorization'] = `Bearer ${authStore.accessToken}`;
  }

  if (idempotencyKey) {
    reqHeaders['Idempotency-Key'] = idempotencyKey;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  let response = await fetch(url, {
    ...customConfig,
    headers: reqHeaders,
  });

  // Handle 401 unauthorized & refresh token attempt
  if (response.status === 401 && !skipAuth && authStore.refreshToken) {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: authStore.refreshToken }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const payload = refreshData.data || refreshData;
        authStore.setAuth(payload.user, payload.accessToken, payload.refreshToken);

        // Retry original request with new access token
        reqHeaders['Authorization'] = `Bearer ${payload.accessToken}`;
        response = await fetch(url, {
          ...customConfig,
          headers: reqHeaders,
        });
      } else {
        authStore.logout();
      }
    } catch {
      authStore.logout();
    }
  }

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    throw new ApiError(
      errorData.code || ErrorCode.INTERNAL_SERVER_ERROR,
      errorData.message || 'An error occurred during the request',
      response.status,
      errorData.errors,
    );
  }

  return (data && typeof data === 'object' && 'data' in data ? data.data : data) as T;
}
