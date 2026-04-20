'use client';

import { useEffect } from 'react';
import { fetchPortalPublic, getStoredPortal } from '@/lib/portal';
import { getApiOrigin } from '@/lib/api-origin';

function absoluteAsset(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${getApiOrigin()}${url}`;
}

export function PortalBootstrap() {
  useEffect(() => {
    const slugHint =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('portalSlug') ?? undefined
        : undefined;
    void fetchPortalPublic(slugHint);
  }, []);

  useEffect(() => {
    const portal = getStoredPortal();
    if (!portal) return;
    if (portal.brandName) document.title = `${portal.brandName} Customer`;
    const icon = absoluteAsset(portal.appIconUrl);
    if (!icon) return;
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    if (link) link.href = icon;
  }, []);

  return null;
}

