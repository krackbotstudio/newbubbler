'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/customer-flow/ui/button';
import { Input } from '@/components/customer-flow/ui/input';
import { customerFlowApi, getCustomerFlowApiError } from '@/lib/customer-flow/api';
import { logoutToBranch } from '@/lib/customer-flow/auth';
import { fetchPortalPublic, getStoredPortal } from '@/lib/customer-flow/portal';
import { useCustomerFlowMe } from '@/hooks/customer-flow/use-me';

export default function CustomerFlowProfilePage() {
  const params = useParams<{ branchSlug: string }>();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const base = `/customer/${branchSlug}`;
  const { data: me, refetch } = useCustomerFlowMe();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [primary, setPrimary] = useState(getStoredPortal()?.primaryColor ?? '#C2185B');
  const [secondary, setSecondary] = useState(getStoredPortal()?.secondaryColor ?? '#fef2f7');

  useEffect(() => {
    if (!branchSlug) return;
    void fetchPortalPublic(branchSlug).then((p) => {
      if (p?.primaryColor) setPrimary(p.primaryColor);
      if (p?.secondaryColor) setSecondary(p.secondaryColor);
    });
  }, [branchSlug]);

  useEffect(() => {
    setName(me?.user?.name ?? '');
    setEmail(me?.user?.email ?? '');
    setPhone(me?.user?.phone ?? '');
  }, [me?.user?.name, me?.user?.email, me?.user?.phone]);

  const textPrimary = useMemo(() => `color-mix(in srgb, ${primary} 80%, #111827)`, [primary]);
  const textMuted = useMemo(() => `color-mix(in srgb, ${primary} 45%, #4b5563)`, [primary]);
  const border = useMemo(() => `color-mix(in srgb, ${secondary} 78%, #d1d5db)`, [secondary]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      await customerFlowApi.patch('/me', { name: name.trim(), email: email.trim() });
      setSuccess('Profile updated');
      await refetch();
    } catch (err) {
      setError(getCustomerFlowApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen pb-24 pt-2" style={{ backgroundColor: '#ffffff' }}>
      <div className="mx-auto max-w-md space-y-4 px-4">
        <section className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: secondary, border: `1px solid ${border}` }}>
          <h1 className="text-2xl font-bold" style={{ color: textPrimary }}>
            Profile
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: textMuted }}>
            Edit your details. Mobile number cannot be changed.
          </p>

          <form onSubmit={onSave} className="mt-6 space-y-4">
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            {success ? <p className="text-sm font-medium text-green-700">{success}</p> : null}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold" style={{ color: textPrimary }}>Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-base leading-normal"
                style={{ backgroundColor: secondary, borderColor: border }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold" style={{ color: textPrimary }}>Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="h-12 text-base leading-normal"
                style={{ backgroundColor: secondary, borderColor: border }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold" style={{ color: textPrimary }}>Mobile number (cannot be changed)</label>
              <Input value={phone} readOnly className="h-12 text-base leading-normal" style={{ backgroundColor: '#ffffff', borderColor: border }} />
            </div>

            <Button type="submit" className="mt-2 h-14 w-full text-base font-semibold" disabled={saving} style={{ backgroundColor: primary }}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </section>

        <Link
          href={`${base}/addresses`}
          className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-medium"
          style={{ backgroundColor: secondary, border: `1px solid ${border}`, color: textPrimary }}
        >
          Edit my addresses
        </Link>

        <button
          type="button"
          className="h-14 w-full rounded-2xl text-base font-semibold"
          style={{ backgroundColor: '#ffffff', border: `1px solid ${primary}`, color: primary }}
          onClick={() => logoutToBranch(branchSlug)}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

