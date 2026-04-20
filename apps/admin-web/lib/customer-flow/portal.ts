import axios from 'axios';
import { getBaseURL } from '@/lib/api';
import { getToken } from './auth';

export interface PortalPublic {
  id: string;
  branchId: string;
  slug: string;
  brandName: string;
  logoUrl: string | null;
  appIconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  termsAndConditions: string | null;
  carouselImages: Array<{ id: string; portalId: string; position: number; imageUrl: string }>;
}

export interface PortalMembership {
  portalId: string;
  portalSlug: string;
  portalBrandName: string;
  isMember: boolean;
  branchId: string;
}

const PORTAL_KEY = 'customer_flow_portal_public';

const portalApi = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

portalApi.interceptors.request.use((config) => {
  config.baseURL = getBaseURL();
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getStoredPortal(): PortalPublic | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PORTAL_KEY);
    return raw ? (JSON.parse(raw) as PortalPublic) : null;
  } catch {
    return null;
  }
}

export function setStoredPortal(portal: PortalPublic | null) {
  if (typeof window === 'undefined') return;
  if (!portal) localStorage.removeItem(PORTAL_KEY);
  else localStorage.setItem(PORTAL_KEY, JSON.stringify(portal));
}

export async function fetchPortalPublic(slugHint: string): Promise<PortalPublic | null> {
  try {
    const { data } = await portalApi.get<PortalPublic>('/portal/public', {
      headers: { 'x-portal-slug': slugHint },
    });
    setStoredPortal(data);
    return data;
  } catch {
    setStoredPortal(null);
    return null;
  }
}

export async function fetchPortalMembership(slugHint: string): Promise<PortalMembership | null> {
  try {
    const { data } = await portalApi.get<PortalMembership>('/portal/membership', {
      headers: { 'x-portal-slug': slugHint },
    });
    return data;
  } catch {
    return null;
  }
}

export async function joinPortalMembership(slugHint: string): Promise<boolean> {
  try {
    await portalApi.post('/portal/membership/join', undefined, {
      headers: { 'x-portal-slug': slugHint },
    });
    return true;
  } catch {
    return false;
  }
}
