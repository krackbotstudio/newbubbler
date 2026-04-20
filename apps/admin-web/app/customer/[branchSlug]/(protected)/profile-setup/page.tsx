'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { customerFlowApi, getCustomerFlowApiError } from '@/lib/customer-flow/api';
import { Button } from '@/components/customer-flow/ui/button';
import { Input } from '@/components/customer-flow/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/customer-flow/ui/card';
import { fetchPortalPublic, getStoredPortal } from '@/lib/customer-flow/portal';

export default function CustomerFlowProfileSetupPage() {
  const router = useRouter();
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const base = `/customer/${branchSlug}`;
  const [primary, setPrimary] = useState(getStoredPortal()?.primaryColor ?? '#8a1459');
  const [secondary, setSecondary] = useState(getStoredPortal()?.secondaryColor ?? '#f4e8f0');
  const [name, setName] = useState('');
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

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }
    setLoading(true);
    try {
      await customerFlowApi.patch('/me', { name: name.trim(), email: email.trim() });
      router.replace(`${base}/orders`);
      router.refresh();
    } catch (err) {
      setError(getCustomerFlowApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4" style={{ backgroundColor: "#ffffff" }}>
      <Card className="w-full max-w-md" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <CardHeader>
          <CardTitle style={{ color: textPrimary }}>Complete your profile</CardTitle>
          <CardDescription style={{ color: textMuted }}>Please add your name and email before continuing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Name</label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading} style={{ backgroundColor: primary }}>
              {loading ? 'Saving...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


