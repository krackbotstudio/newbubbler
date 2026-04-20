import { api } from './api';

export interface PortalPublic {
  id: string;
  branchId: string;
  slug: string;
  brandName: string;
  logoUrl: string | null;
  appIconUrl: string | null;
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

const PORTAL_KEY = 'customer_portal_public';

export function getStoredPortalSlug(): string | null {
  return getStoredPortal()?.slug ?? null;
}

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

export async function fetchPortalPublic(slugHint?: string): Promise<PortalPublic | null> {
  try {
    const headers = slugHint ? { 'x-portal-slug': slugHint } : undefined;
    const { data } = await api.get<PortalPublic>('/portal/public', { headers });
    setStoredPortal(data);
    return data;
  } catch {
    setStoredPortal(null);
    return null;
  }
}

export async function fetchPortalMembership(slugHint?: string): Promise<PortalMembership | null> {
  try {
    const headers = slugHint ? { 'x-portal-slug': slugHint } : undefined;
    const { data } = await api.get<PortalMembership>('/portal/membership', { headers });
    return data;
  } catch {
    return null;
  }
}

export async function joinPortalMembership(slugHint?: string): Promise<boolean> {
  try {
    const headers = slugHint ? { 'x-portal-slug': slugHint } : undefined;
    await api.post('/portal/membership/join', undefined, { headers });
    return true;
  } catch {
    return false;
  }
}

