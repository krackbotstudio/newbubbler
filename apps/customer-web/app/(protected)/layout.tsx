'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { fetchPortalMembership, joinPortalMembership } from '@/lib/portal';
import { api } from '@/lib/api';

export default function CustomerProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (typeof window === 'undefined') return;
      const slugHint = new URLSearchParams(window.location.search).get('portalSlug') ?? undefined;
      const token = getToken();
      if (!token) {
        const qp = new URLSearchParams();
        qp.set('next', pathname);
        if (slugHint) qp.set('portalSlug', slugHint);
        router.replace(`/login?${qp.toString()}`);
        return;
      }
      const membership = await fetchPortalMembership(slugHint);
      if (cancelled || !membership) return;
      if (!membership.isMember) {
        const joined = await joinPortalMembership(slugHint);
        if (!joined && !cancelled) {
          router.replace(slugHint ? `/login?portalSlug=${encodeURIComponent(slugHint)}` : '/login');
          return;
        }
      }

      const me = await api.get<{ user: { name: string | null; email: string | null } }>('/me');
      const missingProfile = !me.data.user.name?.trim() || !me.data.user.email?.trim();
      if (!cancelled && missingProfile && pathname !== '/profile-setup') {
        router.replace('/profile-setup');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return <>{children}</>;
}
