'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { getToken } from '@/lib/customer-flow/auth';
import { fetchPortalMembership, joinPortalMembership } from '@/lib/customer-flow/portal';
import { customerFlowApi } from '@/lib/customer-flow/api';
import { CustomerBottomNav } from '../CustomerBottomNav';

export default function CustomerBranchProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!branchSlug) return;
      const token = getToken();
      if (!token) {
        const qp = new URLSearchParams();
        qp.set('next', pathname);
        router.replace(`/customer/${branchSlug}/login?${qp.toString()}`);
        return;
      }
      const membership = await fetchPortalMembership(branchSlug);
      if (cancelled || !membership) return;
      if (!membership.isMember) {
        const joined = await joinPortalMembership(branchSlug);
        if (!joined && !cancelled) {
          router.replace(`/customer/${branchSlug}/login`);
          return;
        }
      }
      const me = await customerFlowApi.get<{ user: { name: string | null; email: string | null } }>('/me');
      const missingProfile = !me.data.user.name?.trim() || !me.data.user.email?.trim();
      if (!cancelled && missingProfile && pathname !== `/customer/${branchSlug}/profile-setup`) {
        router.replace(`/customer/${branchSlug}/profile-setup`);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, branchSlug]);

  return (
    <>
      <div className="pb-16">{children}</div>
      {branchSlug ? <CustomerBottomNav branchSlug={branchSlug} /> : null}
    </>
  );
}
