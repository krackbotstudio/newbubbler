'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getToken } from '@/lib/customer-flow/auth';

export default function CustomerBranchHomePage() {
  const router = useRouter();
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';

  useEffect(() => {
    if (!branchSlug) return;
    if (getToken()) router.replace(`/customer/${branchSlug}/home`);
    else router.replace(`/customer/${branchSlug}/login`);
  }, [router, branchSlug]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting…</p>
    </div>
  );
}
