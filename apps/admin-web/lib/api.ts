import axios, { type AxiosError } from 'axios';
import { getToken } from './auth';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003/api';

function apiHostnameFromPublicUrl(): string | null {
  const m = API_BASE_URL.match(/^https?:\/\/([^/]+)/);
  return m?.[1] ?? null;
}

/** Same-origin or proxy when admin and API share a domain (Vercel one-project, or Render proxy). */
export function getBaseURL(): string {
  if (typeof window === 'undefined') return API_BASE_URL;
  // Relative /api = same origin (e.g. Vercel single project: admin + API on one domain)
  if (API_BASE_URL === '/api' || API_BASE_URL.startsWith('/api/')) return '/api';
  // Force proxy via env (e.g. Render admin service)
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'true') return '/api-proxy';
  // Use proxy when this app is on Render and the API URL is also on Render
  const onRender = window.location.hostname.endsWith('.onrender.com');
  const apiOnRender = API_BASE_URL.includes('onrender.com');
  if (onRender && apiOnRender) return '/api-proxy';
  // Admin on *.vercel.app + API on another *.vercel.app → same-origin /api-proxy (next.config rewrites)
  const onVercel = window.location.hostname.endsWith('.vercel.app');
  const apiHost = apiHostnameFromPublicUrl();
  if (
    onVercel &&
    apiHost &&
    apiHost.endsWith('.vercel.app') &&
    apiHost !== window.location.hostname
  ) {
    return '/api-proxy';
  }
  return API_BASE_URL;
}

/** Origin of the API server (e.g. http://localhost:3003) for building absolute URLs like PDF links. */
export function getApiOrigin(): string {
  if (typeof window !== 'undefined' && (API_BASE_URL === '/api' || API_BASE_URL.startsWith('/api/')))
    return window.location.origin;
  const u = API_BASE_URL.replace(/\/api\/?$/, '');
  return u || 'http://localhost:3003';
}

const baseURL = API_BASE_URL;
const longTimeoutHost =
  baseURL.includes('onrender.com') ||
  (baseURL.startsWith('http') && baseURL.includes('vercel.app'));

export const api = axios.create({
  baseURL,
  timeout: longTimeoutHost ? 60000 : 15000, // Remote cold start (Render / Vercel serverless)
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = getBaseURL();
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export function getApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const err = data && typeof data === 'object' && 'error' in data
      ? (data.error as { code?: string; message?: string })
      : null;
    if (err?.message) {
      return {
        message: err.message,
        code: err.code,
        status: error.response?.status,
      };
    }
    const msg = data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
      ? (data as { message: string }).message
      : error.message || `Request failed with status ${error.response?.status ?? 'unknown'}`;
    return { message: msg, status: error.response?.status };
  }
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string; status?: number };
    return {
      message: error.message,
      code: typeof withCode.code === 'string' ? withCode.code : undefined,
      status: typeof withCode.status === 'number' ? withCode.status : undefined,
    };
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const o = error as { message: string; code?: string; status?: number };
    return {
      message: o.message,
      code: typeof o.code === 'string' ? o.code : undefined,
      status: typeof o.status === 'number' ? o.status : undefined,
    };
  }
  return { message: 'An unexpected error occurred' };
}

/** User-facing message: prefer API error.message, else fallback. Shorten schema message for toasts. */
export function getFriendlyErrorMessage(error: unknown): string {
  const api = getApiError(error);
  if (api.code === 'SCHEMA_OUT_OF_DATE') {
    return 'Database schema is out of date. From repo root run: npm run prisma:migrate then npm run prisma:generate, then restart the API (npm run dev:api).';
  }
  if (axios.isAxiosError(error) && (error.code === 'ERR_NETWORK' || !error.response)) {
    const isRemoteApi = baseURL.startsWith('https://') || baseURL.includes('onrender.com') || baseURL.includes('vercel.app');
    const cacheHint = ' To load the correct API URL, clear the Next cache: from repo root run npm run dev:admin:fresh, or delete apps/admin-web/.next and restart the dev server.';
    if (isRemoteApi) {
      return `Cannot reach the API at ${baseURL}. Wait a moment and refresh (cold start). In Vercel/Render set NEXT_PUBLIC_API_URL to your API URL (e.g. /api for same domain, or https://your-api.vercel.app/api).${cacheHint}`;
    }
    return `Cannot connect to the API at ${baseURL}. For local API run npm run dev:api from repo root. Set NEXT_PUBLIC_API_URL in apps/admin-web/.env.local (e.g. http://localhost:3003/api).${cacheHint}`;
  }
  if (api.status === 404) {
    let tried = '';
    if (axios.isAxiosError(error) && error.config) {
      const b = (error.config.baseURL ?? '').replace(/\/$/, '');
      const p = error.config.url?.startsWith('/') ? error.config.url : `/${error.config.url ?? ''}`;
      tried = b ? ` Request: ${b}${p === '//' ? '' : p}` : '';
    }
    const proxyHint =
      axios.isAxiosError(error) && error.config?.baseURL === '/api-proxy'
        ? ' For Vercel admin + API on another host, set API_BASE_URL on the admin project to your API root ending in /api (same value as NEXT_PUBLIC_API_URL), then redeploy so the server proxy can reach the API.'
        : '';
    return `The endpoint was not found (404).${tried} Confirm the API project is deployed and serves this path (try GET /api/health on the API host). If you use Vercel, set API_BASE_URL or NEXT_PUBLIC_API_URL on the admin project to your API base ending in /api, then redeploy.${proxyHint}`;
  }
  if (api.status === 401) {
    return 'Invalid email or password. Check that the user exists with role Admin/Billing/OPS and the password is correct.';
  }
  if (api.status === 409) {
    return api.message || 'This request conflicts with existing data.';
  }
  if (api.code === 'USER_DISABLED') {
    return 'This account is disabled. Contact an administrator.';
  }
  const msgLower = (api.message || '').toLowerCase();
  if (
    api.code === 'over_email_send_rate_limit' ||
    msgLower.includes('rate limit') ||
    msgLower.includes('over_email_send') ||
    msgLower.includes('too many requests')
  ) {
    return 'Too many verification emails were sent to this address. Wait a few minutes and try again, or use Resend on the code step after the cooldown. (Supabase enforces per-email send limits.)';
  }
  if (msgLower.includes('dev signup bypass')) {
    return 'Verification could not be completed. Please try again in a moment.';
  }
  return api.message || 'Network/API error';
}

/** Full details string for "Copy error details". */
export function getApiErrorDetails(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data;
    const err = d && typeof d === 'object' && 'error' in d ? (d as { error?: { code?: string; message?: string } }).error : null;
    const status = error.response?.status;
    const parts = [
      status != null ? `Status: ${status}` : '',
      error.code ? `Code: ${error.code}` : '',
      err?.code ? `API Code: ${err.code}` : '',
      err?.message || error.message || 'Request failed',
    ];
    if ((error.code === 'ERR_NETWORK' || !error.response) && baseURL) {
      parts.push(`API URL: ${baseURL}`);
      parts.push('Ensure the API is running and NEXT_PUBLIC_API_URL is correct.');
    }
    return parts.filter(Boolean).join('\n');
  }
  if (error instanceof Error) {
    const any = error as Error & { code?: string; status?: number };
    return [any.name, any.code ? `Code: ${any.code}` : '', any.status ? `Status: ${any.status}` : '', error.message]
      .filter(Boolean)
      .join('\n');
  }
  return 'An unexpected error occurred';
}
