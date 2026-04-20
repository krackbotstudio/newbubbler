'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCustomerFlowPriceList } from '@/hooks/customer-flow/use-price-list';
import { buttonVariants } from '@/components/customer-flow/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/customer-flow/ui/card';
import { Skeleton } from '@/components/customer-flow/ui/skeleton';
import { fetchPortalPublic, getStoredPortal } from '@/lib/customer-flow/portal';

export default function CustomerFlowPriceListPage() {
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const base = `/customer/${branchSlug}`;
  const { data, isLoading, error } = useCustomerFlowPriceList();
  const [primary, setPrimary] = useState(getStoredPortal()?.primaryColor ?? '#8a1459');
  const [secondary, setSecondary] = useState(getStoredPortal()?.secondaryColor ?? '#f4e8f0');

  useEffect(() => {
    if (!branchSlug) return;
    void fetchPortalPublic(branchSlug).then((p) => {
      if (p?.primaryColor) setPrimary(p.primaryColor);
      if (p?.secondaryColor) setSecondary(p.secondaryColor);
    });
  }, [branchSlug]);
  const cardBg = useMemo(() => secondary, [primary, secondary]);
  const cardBorder = useMemo(() => `color-mix(in srgb, ${secondary} 78%, #d1d5db)`, [primary, secondary]);
  const textPrimary = useMemo(() => `color-mix(in srgb, ${primary} 80%, #111827)`, [primary]);
  const textMuted = useMemo(() => `color-mix(in srgb, ${primary} 45%, #4b5563)`, [primary]);

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "#ffffff" }}>
      <header className="mb-6">
        <Link href={`${base}/orders`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Orders
        </Link>
      </header>
      <h1 className="mb-4 text-xl font-semibold" style={{ color: textPrimary }}>Price list</h1>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" style={{ backgroundColor: cardBg }} />
          <Skeleton className="h-24 w-full" style={{ backgroundColor: cardBg }} />
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">Failed to load price list</p> : null}
      {data ? (
        <div className="space-y-3">
          {data.map((item) => (
            <Card key={item.itemId} style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <CardHeader>
                <CardTitle className="text-base" style={{ color: textPrimary }}>{item.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {item.lines.map((line, i) => (
                  <div key={`${item.itemId}-${i}`} className="flex items-center justify-between gap-4">
                    <span style={{ color: textMuted }}>
                      {line.segment} • {line.service}
                    </span>
                    <span className="font-medium" style={{ color: textPrimary }}>Rs. {line.priceRupees}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}


