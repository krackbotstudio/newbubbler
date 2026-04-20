'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { customerFlowApi, getCustomerFlowApiError } from '@/lib/customer-flow/api';
import { setStoredUser, setToken, type CustomerUser } from '@/lib/customer-flow/auth';
import { fetchPortalPublic, getStoredPortal } from '@/lib/customer-flow/portal';
import { getApiOrigin } from '@/lib/api';
import { Button } from '@/components/customer-flow/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/customer-flow/ui/card';

function assetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${getApiOrigin()}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function CustomerFlowLoginPage() {
  const params = useParams<{ branchSlug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const [phone, setPhone] = useState('+91');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [portalBrandName, setPortalBrandName] = useState<string | null>(
    () => getStoredPortal()?.brandName ?? null,
  );
  const [portalTerms, setPortalTerms] = useState<string | null>(
    () => getStoredPortal()?.termsAndConditions ?? null,
  );
  const [portalLogoUrl, setPortalLogoUrl] = useState<string | null>(
    () => getStoredPortal()?.logoUrl ?? null,
  );
  const [primaryColor, setPrimaryColor] = useState<string>('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState<string>('#f4f4f5');
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    if (!branchSlug) return;
    const queryPrimary = searchParams.get('primaryColor')?.trim();
    const querySecondary = searchParams.get('secondaryColor')?.trim();
    const queryLogo = searchParams.get('logoUrl')?.trim();
    const queryBranchName = searchParams.get('branchName')?.trim();
    if (queryPrimary) setPrimaryColor(queryPrimary);
    if (querySecondary) setSecondaryColor(querySecondary);
    if (queryLogo) setPortalLogoUrl(queryLogo);
    if (queryBranchName) setPortalBrandName(queryBranchName);

    const stored = getStoredPortal();
    if (stored?.primaryColor) setPrimaryColor(stored.primaryColor);
    if (stored?.secondaryColor) setSecondaryColor(stored.secondaryColor);
    if (stored?.logoUrl) setPortalLogoUrl(stored.logoUrl);
    void fetchPortalPublic(branchSlug).then((portal) => {
      if (!portal) return;
      setPortalBrandName(portal.brandName ?? null);
      setPortalTerms(portal.termsAndConditions ?? null);
      setPortalLogoUrl(portal.logoUrl ?? null);
      if (portal.primaryColor) setPrimaryColor(portal.primaryColor);
      if (portal.secondaryColor) setSecondaryColor(portal.secondaryColor);
    });
  }, [branchSlug, searchParams]);

  const logoPreviewUrl = assetUrl(portalLogoUrl);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = phone.trim();
    if (!/^\+91[6-9]\d{9}$/.test(normalized)) {
      setError('Use +91 followed by 10 digits');
      return;
    }
    setLoading(true);
    try {
      const { data } = await customerFlowApi.post<{ token: string; user: CustomerUser }>(
        '/auth/customer/mobile/login',
        { phone: normalized },
        { headers: { 'x-portal-slug': branchSlug } },
      );
      setToken(data.token);
      setStoredUser(data.user);
      const next = searchParams.get('next');
      router.replace(next || `/customer/${branchSlug}/home`);
      router.refresh();
    } catch (err) {
      setError(getCustomerFlowApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-[100dvh] min-h-screen w-full items-center justify-center p-4"
      style={{ backgroundColor: "#ffffff" }}
    >
      <Card className="w-full max-w-sm" style={{ borderColor: primaryColor }}>
        <CardHeader>
          <CardTitle style={{ color: primaryColor }}>
            {portalBrandName ? `${portalBrandName} login` : 'Customer login'}
          </CardTitle>
          <CardDescription>Login with mobile number to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              {logoPreviewUrl ? (
                <div className="mb-3 flex justify-center">
                  <img
                    src={logoPreviewUrl}
                    alt="Branch logo"
                    className="h-24 w-24 rounded-md object-contain"
                  />
                </div>
              ) : null}
              <label htmlFor="phone" className="text-sm font-medium">
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+919999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--customer-primary,#2563eb)]"
                style={{ borderColor: primaryColor }}
              />
            </div>
            <Button type="submit" className="w-full" style={{ backgroundColor: primaryColor }} disabled={loading}>
              {loading ? 'Logging in…' : 'Continue'}
            </Button>
          </form>
          {portalTerms ? (
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="mt-4 text-xs underline"
              style={{ color: primaryColor }}
            >
              Terms and conditions
            </button>
          ) : null}
        </CardContent>
      </Card>
      {termsOpen && portalTerms ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Terms and conditions"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h2 className="text-base font-semibold" style={{ color: primaryColor }}>
              Terms and conditions
            </h2>
            <div className="mt-3 max-h-[50vh] overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
              {portalTerms}
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => setTermsOpen(false)} style={{ backgroundColor: primaryColor }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

