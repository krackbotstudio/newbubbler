'use client';

import { useMemo, useState } from 'react';
import { getStoredUser } from '@/lib/auth';
import { useBranches } from '@/hooks/useBranches';
import {
  useBranchCustomerPortal,
  useUpsertBranchCustomerPortal,
  useUploadBranchPortalAppIcon,
  useUploadBranchPortalCarousel,
} from '@/hooks/useCustomerPortal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { restrictBranchesForUser } from '@/lib/auth';
import { getApiOrigin } from '@/lib/api';
import { CUSTOMER_PWA_APP_URL } from '@/lib/customer-app-url';

const USE_IN_ADMIN_CUSTOMER_FLOW = process.env.NEXT_PUBLIC_IN_ADMIN_CUSTOMER_FLOW !== 'false';

function assetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${getApiOrigin()}${url.startsWith('/') ? '' : '/'}${url}`;
}

function toPortalKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CustomerPortalPage() {
  const user = getStoredUser();
  const { data: branches = [] } = useBranches();
  const availableBranches = useMemo(() => {
    if (user?.role === 'ADMIN') return branches;
    if (user?.role === 'OPS') return branches.filter((b) => b.id === user.branchId);
    return restrictBranchesForUser(branches, user);
  }, [branches, user]);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const effectiveBranchId = selectedBranchId || availableBranches[0]?.id || '';
  const { data: portal } = useBranchCustomerPortal(effectiveBranchId);
  const upsert = useUpsertBranchCustomerPortal(effectiveBranchId);
  const uploadIcon = useUploadBranchPortalAppIcon(effectiveBranchId);
  const uploadCarousel = useUploadBranchPortalCarousel(effectiveBranchId);

  const [brandName, setBrandName] = useState('');
  const [slug, setSlug] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');

  if (!user || !['ADMIN', 'OPS'].includes(user.role)) {
    return <div className="text-sm text-muted-foreground">Only admin and branch head can access this page.</div>;
  }

  const effectiveBrandName = brandName || portal?.brandName || '';
  const effectiveSlug = slug || portal?.slug || '';
  const effectiveTerms = termsAndConditions || portal?.termsAndConditions || '';
  const appIconPreview = assetUrl(portal?.appIconUrl);
  const canUploadAssets = Boolean(effectiveBranchId && portal?.id);
  const selectedBranch = availableBranches.find((b) => b.id === effectiveBranchId);

  async function handleSave() {
    try {
      const saved = await upsert.mutateAsync({
        brandName: effectiveBrandName,
        slug: effectiveSlug,
        termsAndConditions: effectiveTerms,
      });
      setBrandName(saved.brandName);
      setSlug(saved.slug);
      setTermsAndConditions(saved.termsAndConditions ?? '');
      toast.success('Customer portal saved');
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Failed to save portal');
    }
  }

  const portalKey = useMemo(
    () => toPortalKey(selectedBranch?.name || effectiveBrandName || effectiveSlug),
    [selectedBranch?.name, effectiveBrandName, effectiveSlug],
  );

  const customerBrandingQuery = useMemo(() => {
    const qp = new URLSearchParams();
    if (selectedBranch?.primaryColor) qp.set('primaryColor', selectedBranch.primaryColor);
    if (selectedBranch?.secondaryColor) qp.set('secondaryColor', selectedBranch.secondaryColor);
    if (selectedBranch?.logoUrl) qp.set('logoUrl', selectedBranch.logoUrl);
    if (selectedBranch?.name) qp.set('branchName', selectedBranch.name);
    return qp;
  }, [
    selectedBranch?.primaryColor,
    selectedBranch?.secondaryColor,
    selectedBranch?.logoUrl,
    selectedBranch?.name,
  ]);

  /** Standalone customer app / PWA (same shape as customer-mobile deep link). */
  const customerPwaUrl = useMemo(() => {
    if (!portalKey) return '';
    const queryString = customerBrandingQuery.toString();
    const base = CUSTOMER_PWA_APP_URL;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}portalSlug=${encodeURIComponent(portalKey)}${queryString ? `&${queryString}` : ''}`;
  }, [portalKey, customerBrandingQuery]);

  /** Opens inside admin-web when enabled. */
  const customerEmbeddedUrl = useMemo(() => {
    if (!USE_IN_ADMIN_CUSTOMER_FLOW || !portalKey) return '';
    const queryString = customerBrandingQuery.toString();
    return `/customer/${encodeURIComponent(portalKey)}${queryString ? `?${queryString}` : ''}`;
  }, [portalKey, customerBrandingQuery]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer Portal</h1>

      <Card>
        <CardHeader>
          <CardTitle>Branch Portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Branch</label>
            <select
              value={effectiveBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Brand name</label>
            <Input
              value={effectiveBrandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Your brand name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Slug</label>
            <Input
              value={effectiveSlug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="brandname"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Terms and conditions</label>
            <textarea
              value={effectiveTerms}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              rows={5}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Terms shown in this branch portal login/home flow"
            />
          </div>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? 'Saving...' : 'Save portal'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Logo is taken from branch branding automatically. Only app icon and carousel images are uploaded here.
          </p>
          {!canUploadAssets ? (
            <p className="text-xs text-amber-600">Save portal first, then upload app icon and carousel images.</p>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium">App icon</label>
            {appIconPreview ? (
              <img
                src={appIconPreview}
                alt="Portal app icon preview"
                className="h-20 w-20 rounded-md border object-contain"
              />
            ) : (
              <p className="text-xs text-muted-foreground">No app icon uploaded yet</p>
            )}
            <Input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              disabled={!canUploadAssets}
              onChange={(e) => {
                if (!canUploadAssets) {
                  toast.error('Save portal first, then upload assets');
                  return;
                }
                const file = e.target.files?.[0];
                if (!file) return;
                uploadIcon.mutate(file, {
                  onSuccess: () => toast.success('App icon uploaded'),
                  onError: (err) => toast.error((err as Error)?.message ?? 'Upload failed'),
                });
              }}
            />
          </div>
          {[1, 2, 3].map((position) => (
            <div key={position} className="space-y-2">
              <label className="text-sm font-medium">Carousel image {position}</label>
              {(() => {
                const image = portal?.carouselImages?.find((item) => item.position === position);
                const preview = assetUrl(image?.imageUrl);
                return preview ? (
                  <img
                    src={preview}
                    alt={`Portal carousel ${position} preview`}
                    className="h-28 w-full max-w-md rounded-md border object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No image uploaded for this slot</p>
                );
              })()}
              <Input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                disabled={!canUploadAssets}
                onChange={(e) => {
                  if (!canUploadAssets) {
                    toast.error('Save portal first, then upload assets');
                    return;
                  }
                  const file = e.target.files?.[0];
                  if (!file) return;
                  uploadCarousel.mutate(
                    { position, file },
                    {
                      onSuccess: () => toast.success(`Carousel ${position} uploaded`),
                      onError: (err) => toast.error((err as Error)?.message ?? 'Upload failed'),
                    },
                  );
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {USE_IN_ADMIN_CUSTOMER_FLOW ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Preview the portal in this admin site (uses your current session when already logged in as admin).
              </p>
              <label className="text-sm font-medium">Embedded link</label>
              <Input value={customerEmbeddedUrl} readOnly placeholder="Select branch and set brand / slug" />
              <Button
                variant="outline"
                onClick={() => {
                  if (!customerEmbeddedUrl) return;
                  window.open(customerEmbeddedUrl, '_blank', 'noopener,noreferrer');
                }}
                disabled={!customerEmbeddedUrl}
              >
                Open embedded customer flow
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Customer PWA / standalone app ({CUSTOMER_PWA_APP_URL}). Set{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">NEXT_PUBLIC_CUSTOMER_PWA_URL</code> if it
              differs from <code className="rounded bg-muted px-1 py-0.5 text-[11px]">NEXT_PUBLIC_CUSTOMER_APP_URL</code>
              .
            </p>
            <label className="text-sm font-medium">Customer PWA link</label>
            <Input value={customerPwaUrl} readOnly placeholder="Select branch and set brand / slug" />
            <Button
              variant="outline"
              onClick={() => {
                if (!customerPwaUrl) return;
                window.open(customerPwaUrl, '_blank', 'noopener,noreferrer');
              }}
              disabled={!customerPwaUrl}
            >
              Open customer PWA
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

