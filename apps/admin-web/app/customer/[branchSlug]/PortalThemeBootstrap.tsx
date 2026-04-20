'use client';

import { useEffect } from 'react';
import { fetchPortalPublic, getStoredPortal } from '@/lib/customer-flow/portal';

interface PortalThemeBootstrapProps {
  branchSlug: string;
}

export function PortalThemeBootstrap({ branchSlug }: PortalThemeBootstrapProps) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const search = new URLSearchParams(window.location.search);
      const qpPrimary = (search.get('primaryColor') ?? '').trim();
      const qpSecondary = (search.get('secondaryColor') ?? '').trim();
      const root = document.documentElement;
      if (qpPrimary) root.style.setProperty('--customer-primary', qpPrimary);
      if (qpSecondary) root.style.setProperty('--customer-secondary', qpSecondary);
      if (qpSecondary) document.body.style.backgroundColor = qpSecondary;

      const portal = await fetchPortalPublic(branchSlug);
      if (!portal || cancelled) return;
      const primary = (portal.primaryColor ?? '').trim();
      const secondary = (portal.secondaryColor ?? '').trim();
      if (primary) root.style.setProperty('--customer-primary', primary);
      if (secondary) root.style.setProperty('--customer-secondary', secondary);
      document.body.style.backgroundColor = secondary || '';
      const currentPortal = getStoredPortal();
      if (currentPortal?.brandName) {
        document.title = `${currentPortal.brandName} Customer`;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchSlug]);

  return null;
}
