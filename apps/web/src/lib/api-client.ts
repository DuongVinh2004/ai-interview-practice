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

async function performTokenRefresh(): Promise<string | null> {
  await useAuthStore.getState().restoreSession();
  return useAuthStore.getState().accessToken;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { idempotencyKey, skipAuth, headers = {}, ...customConfig } = options;
  const authStore = useAuthStore.getState();

  const isFormData = customConfig.body instanceof FormData;
  const reqHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'X-CSRF-Protection': '1',
    ...(headers as Record<string, string>),
  };

  if (isFormData) {
    delete reqHeaders['Content-Type'];
    delete reqHeaders['content-type'];
  }

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
    credentials: customConfig.credentials || 'include',
    headers: reqHeaders,
  });

  // Handle 401 unauthorized & refresh token attempt with global mutex lock (NEW-SEC-04)
  if (response.status === 401 && !skipAuth && !useAuthStore.getState().mfaEnrollmentRequired) {
    const newAccessToken = await performTokenRefresh();
    if (newAccessToken) {
      reqHeaders['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(url, {
        ...customConfig,
        credentials: customConfig.credentials || 'include',
        headers: reqHeaders,
      });
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

apiClient.get = async <T = any>(endpoint: string, options: RequestOptions = {}) => {
  const data = await apiClient<T>(endpoint, { ...options, method: 'GET' });
  return { data };
};

apiClient.post = async <T = any>(endpoint: string, body?: any, options: RequestOptions = {}) => {
  const isFormData = body instanceof FormData;
  const data = await apiClient<T>(endpoint, {
    ...options,
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body),
  });
  return { data };
};

apiClient.put = async <T = any>(endpoint: string, body?: any, options: RequestOptions = {}) => {
  const isFormData = body instanceof FormData;
  const data = await apiClient<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: isFormData ? body : JSON.stringify(body),
  });
  return { data };
};

apiClient.delete = async <T = any>(endpoint: string, options: RequestOptions = {}) => {
  const data = await apiClient<T>(endpoint, { ...options, method: 'DELETE' });
  return { data };
};

apiClient.patch = async <T = any>(endpoint: string, body?: any, options: RequestOptions = {}) => {
  const isFormData = body instanceof FormData;
  const data = await apiClient<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: isFormData ? body : JSON.stringify(body),
  });
  return { data };
};
