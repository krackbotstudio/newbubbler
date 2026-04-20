import axios, { type AxiosError } from 'axios';
import { getBaseURL } from '@/lib/api';
import { getToken } from './auth';
import { getStoredPortal } from './portal';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003/api';

export const customerFlowApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

customerFlowApi.interceptors.request.use((config) => {
  config.baseURL = getBaseURL();
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const portal = getStoredPortal();
  if (portal?.slug) {
    config.headers['x-portal-slug'] = portal.slug;
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
      const portal = getStoredPortal();
      const slug = portal?.slug;
      window.location.href = slug ? `/customer/${slug}/login` : '/';
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
