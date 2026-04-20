import axios, { type AxiosError } from 'axios';
import { getToken } from './auth';

function getPortalSlugFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('customer_portal_public');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { slug?: string };
    const slug = (parsed.slug ?? '').trim();
    return slug || null;
  } catch {
    return null;
  }
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

const baseURL = API_BASE_URL;

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const portalSlug = getPortalSlugFromStorage();
  if (portalSlug) {
    config.headers['x-portal-slug'] = portalSlug;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export function getApiError(error: unknown): ApiError {
  if (error instanceof Error) return { message: error.message };
  if (axios.isAxiosError(error) && error.response?.data?.error) {
    const e = error.response.data.error as { code?: string; message?: string };
    return {
      message: e.message ?? 'Request failed',
      code: e.code,
      status: error.response.status,
    };
  }
  return { message: 'An unexpected error occurred' };
}
