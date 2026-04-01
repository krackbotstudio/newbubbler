'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { getStoredUser } from '@/lib/auth';
import { RoleGate } from '@/components/shared/RoleGate';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FormField } from '@/components/ui/form-field';
import { useBranding, useUpdateBranding, useUploadLogo, useUploadUpiQr, useUploadWelcomeBackground, useUploadAppIcon } from '@/hooks/useBranding';
import { useBranches, useDeleteBranch } from '@/hooks/useBranches';
import { useCarousel, useUploadCarouselImage, useRemoveCarouselImage } from '@/hooks/useCarousel';
import { getApiOrigin } from '@/lib/api';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/api';
import type { UpdateBrandingBody, Branch } from '@/types';
import { Loader2, Pencil, Trash2, Plus } from 'lucide-react';
import { BranchFormModal } from '@/components/branding/BranchFormModal';

const businessFormSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
  footerNote: z.string().nullable(),
  panNumber: z.string().nullable(),
  gstNumber: z.string().nullable(),
  email: z.string().nullable(),
  upiId: z.string().nullable(),
  upiPayeeName: z.string().nullable(),
  upiLink: z.string().nullable(),
  termsAndConditions: z.string().nullable(),
  privacyPolicy: z.string().nullable(),
});

type BusinessFormValues = z.infer<typeof businessFormSchema>;

function imageUrl(url: string | null, cacheBuster?: string | null): string | null {
  if (!url) return null;
  const full = url.startsWith('http') ? url : `${getApiOrigin()}${url.startsWith('/') ? '' : '/'}${url}`;
  if (!cacheBuster) return full;
  return `${full}${full.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheBuster)}`;
}

export default function BrandingPage() {
  const user = getStoredUser();
  const role = user?.role ?? 'CUSTOMER';
  const canEdit = role === 'ADMIN' || role === 'BILLING';

  const { data: branding, isLoading, error } = useBranding();
  const updateBranding = useUpdateBranding();
  const uploadLogo = useUploadLogo();
  const uploadUpiQr = useUploadUpiQr();
  const uploadWelcomeBackground = useUploadWelcomeBackground();
  const uploadAppIcon = useUploadAppIcon();

  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [brandEmail, setBrandEmail] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiLink, setUpiLink] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchModalMode, setBranchModalMode] = useState<'add' | 'edit'>('add');

  const { data: branches = [], isLoading: branchesLoading } = useBranches();
  const deleteBranch = useDeleteBranch();

  const { data: carouselData, isLoading: carouselLoading } = useCarousel();
  const uploadCarousel = useUploadCarouselImage();
  const removeCarousel = useRemoveCarouselImage();
  const slots = carouselData?.slots ?? [null, null, null];

  useEffect(() => {
    if (branding) {
      setBusinessName(branding.businessName);
      setAddress(branding.address);
      setPhone(branding.phone);
      setFooterNote(branding.footerNote ?? '');
      setPanNumber(branding.panNumber ?? '');
      setGstNumber(branding.gstNumber ?? '');
      setBrandEmail(branding.email ?? '');
      setUpiId(branding.upiId ?? '');
      setUpiPayeeName(branding.upiPayeeName ?? '');
      setUpiLink(branding.upiLink ?? '');
      setTermsAndConditions(branding.termsAndConditions ?? '');
      setPrivacyPolicy(branding.privacyPolicy ?? '');
    }
  }, [branding]);

  const handleSaveBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    const result = businessFormSchema.safeParse({
      businessName: businessName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      footerNote: footerNote.trim() || null,
      panNumber: panNumber.trim() || null,
      gstNumber: gstNumber.trim() || null,
      email: brandEmail.trim() || null,
      upiId: upiId.trim() || null,
      upiPayeeName: upiPayeeName.trim() || null,
      upiLink: upiLink.trim() || null,
      termsAndConditions: termsAndConditions.trim() || null,
      privacyPolicy: privacyPolicy.trim() || null,
    });
    if (!result.success) {
      const first = result.error.flatten().fieldErrors;
      const msg =
        first.businessName?.[0] ?? first.address?.[0] ?? first.phone?.[0] ?? result.error.message;
      toast.error(msg);
      return;
    }
    const body: UpdateBrandingBody = {
      businessName: result.data.businessName,
      address: result.data.address,
      phone: result.data.phone,
      footerNote: result.data.footerNote,
      panNumber: result.data.panNumber,
      gstNumber: result.data.gstNumber,
      email: result.data.email,
      upiId: result.data.upiId,
      upiPayeeName: result.data.upiPayeeName,
      upiLink: result.data.upiLink,
      termsAndConditions: result.data.termsAndConditions,
      privacyPolicy: result.data.privacyPolicy,
    };
    updateBranding.mutate(body, {
      onSuccess: () => toast.success('Business info saved'),
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadLogo.mutate(file, {
      onSuccess: () => {
        toast.success('Logo uploaded');
        e.target.value = '';
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const handleUpiQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadUpiQr.mutate(file, {
      onSuccess: () => {
        toast.success('UPI QR uploaded');
        e.target.value = '';
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const handleWelcomeBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    e.target.value = '';
    uploadWelcomeBackground.mutate(file, {
      onSuccess: () => {
        toast.success('Welcome page background uploaded (shown at 50% opacity on mobile)');
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const brandingVersion = branding?.updatedAt ?? null;
  const logoPreviewUrl = branding?.logoUrl ? imageUrl(branding.logoUrl, brandingVersion) : null;
  const upiQrPreviewUrl = branding?.upiQrUrl ? imageUrl(branding.upiQrUrl, brandingVersion) : null;
  const welcomeBgPreviewUrl = branding?.welcomeBackgroundUrl ? imageUrl(branding.welcomeBackgroundUrl, brandingVersion) : null;
  const appIconPreviewUrl = branding?.appIconUrl ? imageUrl(branding.appIconUrl, brandingVersion) : null;

  const handleAppIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    e.target.value = '';
    uploadAppIcon.mutate(file, {
      onSuccess: () => toast.success('App icon uploaded'),
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const handleAddBranch = () => {
    setEditingBranch(null);
    setBranchModalMode('add');
    setBranchModalOpen(true);
  };
  const handleEditBranch = (b: Branch) => {
    setEditingBranch(b);
    setBranchModalMode('edit');
    setBranchModalOpen(true);
  };
  const handleDeleteBranch = (b: Branch) => {
    if (!confirm(`Delete branch "${b.name}"?`)) return;
    deleteBranch.mutate(b.id, {
      onSuccess: () => toast.success('Branch deleted'),
      onError: (err) => toast.error(getFriendlyErrorMessage(err)),
    });
  };

  const handleCarouselUpload = (position: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    e.target.value = '';
    uploadCarousel.mutate(
      { file, position },
      {
        onSuccess: () => toast.success(`Slot ${position} updated`),
        onError: (err) => toast.error(getFriendlyErrorMessage(err)),
      },
    );
  };
  const handleCarouselRemove = (position: number) => () => {
    if (!confirm(`Remove image from slot ${position}?`)) return;
    removeCarousel.mutate(position, {
      onSuccess: () => toast.success('Image removed'),
      onError: (err) => toast.error(getFriendlyErrorMessage(err)),
    });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-sm text-destructive">Failed to load branding.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Branding</h1>
      <p className="text-sm text-muted-foreground">
        Logo, UPI and payment links are shared across the brand. Each branch has its own address and phone.
      </p>

      {/* Brand (common): Logo, UPI, payment links — on top */}
      <Card>
        <CardHeader>
          <CardTitle>Brand</CardTitle>
          <p className="text-sm text-muted-foreground">
            Logo, UPI ID and payment links apply to all branches.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-32 rounded-md" />
            </div>
          ) : (
            <>
              <form onSubmit={handleSaveBusiness} className="space-y-4">
                <FormField label="Business name" htmlFor="businessName">
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Business name"
                  />
                </FormField>
                <FormField label="PAN number (optional)" htmlFor="panNumber">
                  <Input
                    id="panNumber"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. AAAAA9999A"
                  />
                </FormField>
                <FormField label="GST number (optional)" htmlFor="gstNumber">
                  <Input
                    id="gstNumber"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. 29AAAAA9999A1Z5"
                  />
                </FormField>
                <FormField label="Email (optional)" htmlFor="brandEmail">
                  <Input
                    id="brandEmail"
                    type="email"
                    value={brandEmail}
                    onChange={(e) => setBrandEmail(e.target.value)}
                    disabled={!canEdit}
                    placeholder="brand@example.com"
                  />
                </FormField>
                <FormField label="UPI ID (optional)" htmlFor="upiId">
                  <Input
                    id="upiId"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. business@upi"
                  />
                </FormField>
                <FormField label="UPI payee name (optional)" htmlFor="upiPayeeName">
                  <Input
                    id="upiPayeeName"
                    value={upiPayeeName}
                    onChange={(e) => setUpiPayeeName(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Payee name"
                  />
                </FormField>
                <FormField label="UPI link (optional)" htmlFor="upiLink">
                  <Input
                    id="upiLink"
                    value={upiLink}
                    onChange={(e) => setUpiLink(e.target.value)}
                    disabled={!canEdit}
                    placeholder="https://..."
                  />
                </FormField>
                <FormField label="Footer note (optional)" htmlFor="footerNote">
                  <Input
                    id="footerNote"
                    value={footerNote}
                    onChange={(e) => setFooterNote(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Footer note"
                  />
                </FormField>
                {role === 'ADMIN' && (
                  <>
                    <p className="text-sm font-medium text-muted-foreground border-b pb-2 mb-2">
                      Mobile app – Terms and Conditions &amp; Privacy Policy (super admin only). Customers must accept these before logging in.
                    </p>
                    <FormField label="Terms and Conditions (mobile app)" htmlFor="termsAndConditions">
                      <textarea
                        id="termsAndConditions"
                        value={termsAndConditions}
                        onChange={(e) => setTermsAndConditions(e.target.value)}
                        disabled={!canEdit}
                        placeholder="e.g. By using this app you agree to..."
                        rows={5}
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </FormField>
                    <FormField label="Privacy Policy (mobile app)" htmlFor="privacyPolicy">
                      <textarea
                        id="privacyPolicy"
                        value={privacyPolicy}
                        onChange={(e) => setPrivacyPolicy(e.target.value)}
                        disabled={!canEdit}
                        placeholder="e.g. We collect and use your data..."
                        rows={5}
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </FormField>
                  </>
                )}
                {role !== 'ADMIN' && (
                  <FormField label="Terms and Conditions (mobile app) — view only (edit as super admin)" htmlFor="termsAndConditionsReadOnly">
                    <textarea
                      id="termsAndConditionsReadOnly"
                      value={termsAndConditions}
                      readOnly
                      rows={5}
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm cursor-not-allowed opacity-90"
                    />
                  </FormField>
                )}
                <RoleGate role={role} gate="brandingEdit">
                  <Button type="submit" disabled={updateBranding.isPending}>
                    {updateBranding.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save brand'
                    )}
                  </Button>
                </RoleGate>
              </form>

              <div className="border-t pt-6 space-y-4">
                <span className="text-sm font-medium">Logo</span>
                {logoPreviewUrl && (
                  <div className="flex flex-col gap-2">
                    <img
                      src={logoPreviewUrl}
                      alt="Logo"
                      className="h-24 w-auto max-w-[200px] rounded-md border object-contain"
                    />
                  </div>
                )}
                <RoleGate role={role} gate="brandingEdit">
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                    disabled={uploadLogo.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadLogo.isPending}
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    {uploadLogo.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                    ) : (
                      'Upload logo'
                    )}
                  </Button>
                </RoleGate>
              </div>

              <div className="border-t pt-6 space-y-4">
                <span className="text-sm font-medium">UPI QR</span>
                {upiQrPreviewUrl && (
                  <img
                    src={upiQrPreviewUrl}
                    alt="UPI QR"
                    className="h-32 w-32 rounded-md border object-contain"
                  />
                )}
                <RoleGate role={role} gate="brandingEdit">
                  <input
                    id="upi-qr-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpiQrChange}
                    disabled={uploadUpiQr.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadUpiQr.isPending}
                    onClick={() => document.getElementById('upi-qr-upload')?.click()}
                  >
                    {uploadUpiQr.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                    ) : (
                      'Upload UPI QR'
                    )}
                  </Button>
                </RoleGate>
              </div>

              <div className="border-t pt-6 space-y-4">
                <span className="text-sm font-medium">App Icon</span>
                <p className="text-xs text-muted-foreground">
                  Used as the mobile app icon and admin panel favicon. Use a square PNG (recommended 1024×1024).
                </p>
                {appIconPreviewUrl && (
                  <img
                    src={appIconPreviewUrl}
                    alt="App Icon"
                    className="h-20 w-20 rounded-xl border object-contain"
                  />
                )}
                <RoleGate role={role} gate="brandingEdit">
                  <input
                    id="app-icon-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAppIconChange}
                    disabled={uploadAppIcon.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadAppIcon.isPending}
                    onClick={() => document.getElementById('app-icon-upload')?.click()}
                  >
                    {uploadAppIcon.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                    ) : (
                      appIconPreviewUrl ? 'Replace app icon' : 'Upload app icon'
                    )}
                  </Button>
                </RoleGate>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Home page carousel — up to 3 images for mobile app */}
      <Card>
        <CardHeader>
          <CardTitle>Home page carousel</CardTitle>
          <p className="text-sm text-muted-foreground">
            Up to 3 images shown in the mobile app home carousel. Order is slot 1 → 2 → 3.
          </p>
        </CardHeader>
        <CardContent>
          {carouselLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([1, 2, 3] as const).map((pos) => {
                const slot = slots[pos - 1];
                const previewUrl = slot?.imageUrl ? imageUrl(slot.imageUrl, slot?.updatedAt ?? null) : null;
                return (
                  <div
                    key={pos}
                    className="rounded-lg border p-3 flex flex-col items-center gap-2 min-h-[140px]"
                  >
                    <span className="text-sm font-medium text-muted-foreground">Slot {pos}</span>
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={`Carousel ${pos}`}
                        className="h-24 w-full max-w-[200px] rounded object-cover"
                      />
                    ) : (
                      <div className="h-24 w-full max-w-[200px] rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        No image
                      </div>
                    )}
                    <RoleGate role={role} gate="brandingEdit">
                      <div className="flex gap-2 flex-wrap justify-center">
                        <input
                          id={`carousel-upload-${pos}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCarouselUpload(pos)}
                          disabled={uploadCarousel.isPending}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadCarousel.isPending}
                          onClick={() => document.getElementById(`carousel-upload-${pos}`)?.click()}
                        >
                          {uploadCarousel.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Upload'
                          )}
                        </Button>
                        {previewUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={removeCarousel.isPending}
                            onClick={handleCarouselRemove(pos)}
                          >
                            {removeCarousel.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </RoleGate>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branches — each with own address & phone */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Branches</CardTitle>
            <RoleGate role={role} gate="brandingEdit">
              <Button onClick={handleAddBranch} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add branch
              </Button>
            </RoleGate>
          </div>
        </CardHeader>
        <CardContent>
          {branchesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : branches.length === 0 ? (
            <p className="text-muted-foreground text-sm">No branches yet. Add one to set address and phone per branch.</p>
          ) : (
            <ul className="space-y-3">
              {branches.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium flex items-center gap-2">
                      {b.name}
                      {b.isDefault && (
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Main
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm">{b.address}</p>
                    {b.phone && (
                      <p className="text-muted-foreground text-sm">Phone: {b.phone}</p>
                    )}
                    {b.email && (
                      <p className="text-muted-foreground text-sm">Email: {b.email}</p>
                    )}
                    {b.footerNote && (
                      <p className="text-muted-foreground text-xs">{b.footerNote}</p>
                    )}
                  </div>
                  <RoleGate role={role} gate="brandingEdit">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditBranch(b)}
                        title="Edit branch"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteBranch(b)}
                        disabled={deleteBranch.isPending}
                        title="Delete branch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </RoleGate>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <BranchFormModal
        branch={editingBranch}
        open={branchModalOpen}
        onOpenChange={setBranchModalOpen}
        mode={branchModalMode}
      />
    </div>
  );
}
