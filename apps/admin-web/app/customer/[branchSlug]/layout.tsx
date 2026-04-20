'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { customerFlowQueryClient } from '@/lib/customer-flow/query-client';
import { PortalThemeBootstrap } from './PortalThemeBootstrap';

export default function CustomerBranchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';

  return (
    <QueryClientProvider client={customerFlowQueryClient}>
      <PortalThemeBootstrap branchSlug={branchSlug} />
      {children}
    </QueryClientProvider>
  );
}
