import axios, { type AxiosError } from 'axios';
import { getBaseURL } from '@/lib/api';
import { getToken } from './auth';
import { getStoredPortal } from './portal';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003/api';

/** Prefer slug from the current URL so API scope matches the branch route (avoids stale localStorage after switching branches). */
function portalSlugHintFromBrowserPath(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const m = window.location.pathname.match(/^\/customer\/([^/]+)/);
  const raw = m?.[1];
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export const customerFlowApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

customerFlowApi.interceptors.request.use((config) => {
  config.baseURL = getBaseURL();
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const portal = getStoredPortal();
  const slugHint = portalSlugHintFromBrowserPath() ?? portal?.slug;
  if (slugHint) {
    config.headers['x-portal-slug'] = slugHint;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

customerFlowApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const slug = portalSlugHintFromBrowserPath() ?? getStoredPortal()?.slug;
      window.location.href = slug ? `/customer/${encodeURIComponent(slug)}/login` : '/';
    }
    return Promise.reject(error);
  },
);

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export function getCustomerFlowApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error) && (error.code === 'ERR_NETWORK' || !error.response)) {
    return {
      message:
        'Network error: cannot reach API. Verify NEXT_PUBLIC_API_URL or use same-origin /api setup.',
    };
  }
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as
      | { error?: { code?: string; message?: string }; message?: string | string[] }
      | undefined;
    const nested = data?.error;
    const message =
      nested?.message
      ?? (Array.isArray(data?.message) ? data?.message.join(', ') : data?.message)
      ?? error.message
      ?? 'Request failed';
    return {
      message,
      code: nested?.code,
      status: error.response.status,
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: 'An unexpected error occurred' };
}
