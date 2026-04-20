import { API_BASE_URL } from './api';

export function getApiOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:3003';
  }
}

