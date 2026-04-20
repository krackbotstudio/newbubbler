'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { getStoredUser, setStoredUser, type AuthUser } from '@/lib/auth';
import { api, getApiError, getApiOrigin } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { useBranch, useUpdateBranch, useUploadBranchLogo, useBranchFieldUniquenessQuery } from '@/hooks/useBranches';
import { BranchUniquenessUnderField } from '@/components/branding/BranchFieldUniquenessHints';
import { useServiceAreas, useCreateServiceArea, useDeleteServiceArea } from '@/hooks/useServiceAreas';
import { toast } from 'sonner';
import { CalendarCheck2, ClipboardList, Home, ListOrdered, Loader2, UserRound, X } from 'lucide-react';

function phoneDigitsLen(s: string): number {
  return s.replace(/\D/g, '').length;
}

const branchSchema = z
  .object({
    name: z.string().min(1, 'Branch name is required'),
    address: z.string().min(1, 'Address is required'),
    mobile: z
      .string()
      .trim()
      .min(1, 'Mobile number is required')
      .max(50)
      .refine(
        (s) => {
          const d = s.replace(/\D/g, '');
          return d.length >= 10 && d.length <= 15;
        },
        'Enter a valid mobile number (10–15 digits, spaces or + allowed)',
      ),
    email: z.string().max(254).optional(),
    gstNumber: z.string().max(32).optional(),
    panNumber: z.string().max(20).optional(),
    invoicePrefix: z.string().max(24).optional(),
    itemTagBrandName: z.string().max(40).optional(),
    footerNote: z.string().max(500).optional(),
    upiId: z.string().max(120).optional(),
    upiPayeeName: z.string().max(120).optional(),
    upiLink: z.string().max(500).optional(),
    primaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Primary color must be a 6-digit hex like #0f3d91'),
    secondaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Secondary color must be a 6-digit hex like #e8f0ff'),
    termsAndConditions: z
      .string()
      .trim()
      .min(1, 'Terms and conditions are required (they appear on your branch invoices)'),
  })
  .superRefine((data, ctx) => {
    const em = data.email?.trim();
    if (em && !z.string().email().safeParse(em).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid public branch email',
        path: ['email'],
      });
    }
  });

const textareaClass = cn(
  'flex min-h-[140px] w-full rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-offset-background placeholder:font-normal placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-200 dark:placeholder:text-gray-400',
);

function branchLogoUrl(logoUrl: string | null, updatedAt: string): string | null {
  if (!logoUrl) return null;
  const full = logoUrl.startsWith('http') ? logoUrl : `${getApiOrigin()}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
  return `${full}${full.includes('?') ? '&' : '?'}v=${encodeURIComponent(updatedAt)}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const user = getStoredUser();
  const branchId = user?.branchId ?? null;
  const { data: branch, isLoading: branchLoading, error: branchError } = useBranch(branchId);
  const updateBranch = useUpdateBranch(branchId ?? '');
  const uploadLogo = useUploadBranchLogo(branchId ?? '');
  const { data: areas = [], isLoading: areasLoading } = useServiceAreas(branchId ?? undefined);
  const createArea = useCreateServiceArea();
  const deleteArea = useDeleteServiceArea();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [itemTagBrandName, setItemTagBrandName] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiLink, setUpiLink] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0f3d91');
  const [secondaryColor, setSecondaryColor] = useState('#e8f0ff');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [finishError, setFinishError] = useState<unknown>(null);
  const [finishing, setFinishing] = useState(false);

  const uniqueness = useBranchFieldUniquenessQuery({
    excludeBranchId: branchId ?? undefined,
    name,
    invoicePrefix,
    itemTagBrandName,
    enabled: !!branchId,
  });

  useEffect(() => {
    if (branch) {
      setName(branch.name);
      setAddress(branch.address);
      setPhone(branch.phone ?? '');
      setEmail(branch.email ?? '');
      setGstNumber(branch.gstNumber ?? '');
      setPanNumber(branch.panNumber ?? '');
      setInvoicePrefix(branch.invoicePrefix ?? '');
      setItemTagBrandName(branch.itemTagBrandName ?? '');
      setFooterNote(branch.footerNote ?? '');
      setUpiId(branch.upiId ?? '');
      setUpiPayeeName(branch.upiPayeeName ?? '');
      setUpiLink(branch.upiLink ?? '');
      setPrimaryColor(branch.primaryColor ?? '#0f3d91');
      setSecondaryColor(branch.secondaryColor ?? '#e8f0ff');
      setTermsAndConditions(branch.termsAndConditions ?? '');
    }
  }, [branch]);

  useEffect(() => {
    const u = getStoredUser();
    if (!u || u.role !== 'OPS' || !u.branchId) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    const parsed = branchSchema.safeParse({
      name: name.trim(),
      address: address.trim(),
      mobile: phone.trim(),
      email: email.trim() || undefined,
      gstNumber: gstNumber.trim() || undefined,
      panNumber: panNumber.trim() || undefined,
      invoicePrefix: invoicePrefix.trim() || undefined,
      itemTagBrandName: itemTagBrandName.trim() || undefined,
      footerNote: footerNote.trim() || undefined,
      upiId: upiId.trim() || undefined,
      upiPayeeName: upiPayeeName.trim() || undefined,
      upiLink: upiLink.trim() || undefined,
      primaryColor: primaryColor.trim(),
      secondaryColor: secondaryColor.trim(),
      termsAndConditions: termsAndConditions.trim(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Invalid');
      return;
    }
    const u = uniqueness.data;
    if (u) {
      if (parsed.data.name.trim() && !u.name.available) {
        toast.error('Choose a unique branch name (see hint below the field).');
        return;
      }
      if (parsed.data.invoicePrefix?.trim() && !u.invoicePrefix.available) {
        toast.error('Choose a unique invoice prefix not used by another branch.');
        return;
      }
      if (parsed.data.itemTagBrandName?.trim() && !u.itemTagBrandName.available) {
        toast.error('Choose a unique short brand on item tag not used by another branch.');
        return;
      }
    }
    updateBranch.mutate(
      {
        name: parsed.data.name,
        address: parsed.data.address,
        phone: parsed.data.mobile,
        email: parsed.data.email?.trim() || null,
        gstNumber: parsed.data.gstNumber?.trim() || null,
        panNumber: parsed.data.panNumber?.trim() || null,
        invoicePrefix: parsed.data.invoicePrefix?.trim() || null,
        itemTagBrandName: parsed.data.itemTagBrandName?.trim() || null,
        footerNote: parsed.data.footerNote?.trim() || null,
        upiId: parsed.data.upiId?.trim() || null,
        upiPayeeName: parsed.data.upiPayeeName?.trim() || null,
        upiLink: parsed.data.upiLink?.trim() || null,
        primaryColor: parsed.data.primaryColor.trim(),
        secondaryColor: parsed.data.secondaryColor.trim(),
        termsAndConditions: parsed.data.termsAndConditions.trim(),
      },
      {
        onSuccess: () => toast.success('Branch details saved'),
        onError: (err) => toast.error(getApiError(err).message),
      },
    );
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadLogo.mutate(file, {
      onSuccess: () => {
        toast.success('Logo uploaded');
        e.target.value = '';
      },
      onError: (err) => toast.error(getApiError(err).message),
    });
  };

  const parsePincodes = (input: string) => {
    const tokens = input.split(',').map((p) => p.trim()).filter(Boolean);
    const unique = Array.from(new Set(tokens));
    const valid = unique.filter((p) => /^\d{6}$/.test(p));
    const invalid = unique.filter((p) => !/^\d{6}$/.test(p));
    return { valid, invalid };
  };

  const handleAddPincodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    const parsed = parsePincodes(pinInput);
    if (parsed.valid.length === 0) {
      toast.error('Enter at least one 6-digit pincode (comma-separated for several).');
      return;
    }
    if (parsed.invalid.length > 0) {
      toast.error(`Invalid: ${parsed.invalid.join(', ')}`);
      return;
    }
    for (const pin of parsed.valid) {
      try {
        await createArea.mutateAsync({ pincode: pin, branchId, active: true });
      } catch (err) {
        toast.error(getApiError(err).message);
        return;
      }
    }
    toast.success(`Added ${parsed.valid.length} pincode(s)`);
    setPinInput('');
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinishError(null);
    setFinishing(true);
    try {
      await api.post('/auth/admin/onboarding/finish');
      const { data: profile } = await api.get<{
        id: string;
        email: string | null;
        role: AuthUser['role'];
        branchId: string | null;
        onboardingCompletedAt: string | null;
      }>('/auth/admin/profile');
      setStoredUser({
        id: profile.id,
        email: profile.email ?? undefined,
        role: profile.role,
        branchId: profile.branchId,
        onboardingCompletedAt: profile.onboardingCompletedAt,
      });
      toast.success('Onboarding complete');
      // Full navigation so ProtectedLayout refetches profile (client state was still “incomplete”).
      window.location.assign('/dashboard');
    } catch (err) {
      setFinishError(err);
      setFinishing(false);
    }
  };

  if (!user || user.role !== 'OPS' || !branchId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (branchError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Finish setup</h1>
        <ErrorDisplay error={branchError} />
      </div>
    );
  }

  const hasLogo = !!branch?.logoUrl?.trim();
  const pinCount = areas.filter((a) => a.active).length;
  const effectiveMobile = phone.trim() || branch?.phone?.trim() || '';
  const mobileOk = phoneDigitsLen(effectiveMobile) >= 10 && phoneDigitsLen(effectiveMobile) <= 15;
  const effectiveTerms = (termsAndConditions.trim() || branch?.termsAndConditions?.trim() || '').length >= 1;
  const hasUniquenessConflict =
    !!uniqueness.data &&
    ((Boolean(name.trim()) && !uniqueness.data.name.available) ||
      (Boolean(invoicePrefix.trim()) && !uniqueness.data.invoicePrefix.available) ||
      (Boolean(itemTagBrandName.trim()) && !uniqueness.data.itemTagBrandName.available));
  const canFinish = hasLogo && pinCount >= 1 && mobileOk && effectiveTerms && !hasUniquenessConflict;
  const preview = branch ? branchLogoUrl(branch.logoUrl, branch.updatedAt) : null;

  return (
    <div
      className="mx-auto max-w-2xl space-y-8"
      style={
        {
          '--primary': '221 83% 43%',
          '--ring': '221 83% 43%',
          '--secondary': '213 100% 97%',
        } as CSSProperties
      }
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finish branch setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and save your branch profile (including GST, PAN, and invoice terms), upload your branch logo, add
          at least one serviceable pincode, then continue to the admin console.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Branch details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Values from signup are shown here; update anything before saving. Mobile number and terms are required to
            finish onboarding.
          </p>
        </CardHeader>
        <CardContent>
          {branchLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <form onSubmit={handleSaveBranch} className="space-y-4">
              <FormField label="Branch name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <BranchUniquenessUnderField
                  slot={uniqueness.data?.name}
                  isEmpty={!name.trim()}
                  availableLabel="Available — no other branch uses this name (case-insensitive)."
                  takenTemplate={(other) =>
                    `This name matches "${other}". Each branch must have a distinct name (case-insensitive).`
                  }
                />
              </FormField>
              <FormField label="Address">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </FormField>
              <FormField label="Mobile number">
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210 or 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </FormField>
              <FormField label="Public branch email (optional)">
                <Input
                  type="email"
                  placeholder="contact@mylaundry.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="GST number (optional)">
                  <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
                </FormField>
                <FormField label="PAN (optional)">
                  <Input value={panNumber} onChange={(e) => setPanNumber(e.target.value)} />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Invoice prefix (optional)">
                  <Input
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    placeholder="e.g. TKS"
                    maxLength={24}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    When set, ACK and Final invoice codes include this segment (letters, numbers, hyphen, underscore).
                  </p>
                  <BranchUniquenessUnderField
                    slot={uniqueness.data?.invoicePrefix}
                    isEmpty={!invoicePrefix.trim()}
                    optionalEmptyHelp="Optional. If set, it must be unique across all branches (case-insensitive) so invoice codes do not clash."
                    availableLabel="Available — this prefix is not used by another branch (case-insensitive)."
                    takenTemplate={(other) =>
                      `This prefix is already used by "${other}". Use a different prefix for each branch.`
                    }
                  />
                </FormField>
                <FormField label="Short brand name on item tag (optional)">
                  <Input
                    value={itemTagBrandName}
                    onChange={(e) => setItemTagBrandName(e.target.value)}
                    placeholder="e.g. TKS"
                    maxLength={40}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Printed on garment tags for this branch; falls back to branch name or company name if empty.
                  </p>
                  <BranchUniquenessUnderField
                    slot={uniqueness.data?.itemTagBrandName}
                    isEmpty={!itemTagBrandName.trim()}
                    optionalEmptyHelp="Optional. If set, it must be unique across branches (case-insensitive) so printed tags stay distinct."
                    availableLabel="Available — this tag line is not used by another branch (case-insensitive)."
                    takenTemplate={(other) =>
                      `This tag line is already used by "${other}". Use a different short brand for each branch.`
                    }
                  />
                </FormField>
              </div>
              <FormField label="Footer note on invoices (optional)">
                <Input value={footerNote} onChange={(e) => setFooterNote(e.target.value)} />
              </FormField>
              <FormField label="UPI ID (optional)">
                <Input placeholder="name@bank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
              </FormField>
              <FormField label="UPI payee name (optional)">
                <Input value={upiPayeeName} onChange={(e) => setUpiPayeeName(e.target.value)} />
              </FormField>
              <FormField label="UPI payment link (optional)">
                <Input type="url" placeholder="https://…" value={upiLink} onChange={(e) => setUpiLink(e.target.value)} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Primary color (required)">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : '#0f3d91'}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                      aria-label="Pick primary color"
                    />
                    <Input
                      type="text"
                      placeholder="#0f3d91"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Main accent for customer app (buttons, active order cards, highlights).
                  </p>
                </FormField>
                <FormField label="Secondary color (required)">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(secondaryColor) ? secondaryColor : '#e8f0ff'}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                      aria-label="Pick secondary color"
                    />
                    <Input
                      type="text"
                      placeholder="#e8f0ff"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Surface/tile background for customer app cards.
                  </p>
                </FormField>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: '#dbeafe', backgroundColor: '#f8fbff' }}>
                <p className="text-sm font-semibold" style={{ color: '#1e3a8a' }}>Customer Orders preview</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Preview with one active order and one delivered order to finalize branch colors.
                </p>
                <div className="mt-3 flex justify-center">
                  <div className="w-full max-w-[340px] rounded-[30px] border-4 border-slate-800 bg-slate-900 p-2 shadow-xl">
                    <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-slate-700" />
                    <div className="flex h-[640px] flex-col overflow-hidden rounded-[20px] bg-white">
                      <div className="border-b px-4 py-3" style={{ borderColor: `color-mix(in srgb, ${secondaryColor} 78%, #d1d5db)` }}>
                        <p className="text-xs font-medium" style={{ color: `color-mix(in srgb, ${primaryColor} 45%, #4b5563)` }}>
                          ← Orders
                        </p>
                        <p className="mt-2 text-xl font-bold" style={{ color: `color-mix(in srgb, ${primaryColor} 80%, #111827)` }}>
                          Orders
                        </p>
                        <p className="mt-1 text-xs" style={{ color: `color-mix(in srgb, ${primaryColor} 45%, #4b5563)` }}>
                          All orders (ongoing and completed) with status and utilisation.
                        </p>
                      </div>

                      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
                        <div
                          className="rounded-xl border p-3"
                          style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">#TKS123456</p>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ backgroundColor: '#ffffff', color: primaryColor }}
                            >
                              Online
                            </span>
                          </div>
                          <p className="text-sm text-white">2026-04-20 10:00-12:00</p>
                          <p className="mt-1 text-[13px] text-white/90">Utilisation: Wash and Iron</p>
                          <p className="mt-2 text-sm font-semibold text-white">Amount to pay: ₹672.00</p>
                          <span className="mt-2 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white">
                            Picked up
                          </span>
                        </div>
                        <div
                          className="rounded-xl border p-3"
                          style={{
                            backgroundColor: secondaryColor,
                            borderColor: `color-mix(in srgb, ${secondaryColor} 78%, #d1d5db)`,
                          }}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <p className="truncate text-sm font-semibold" style={{ color: `color-mix(in srgb, ${primaryColor} 80%, #111827)` }}>
                              #TKS654321
                            </p>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                              style={{ backgroundColor: primaryColor }}
                            >
                              Walk-in
                            </span>
                          </div>
                          <p className="text-sm" style={{ color: `color-mix(in srgb, ${primaryColor} 80%, #111827)` }}>2026-04-19 16:00-18:00</p>
                          <p className="mt-1 text-[13px]" style={{ color: `color-mix(in srgb, ${primaryColor} 45%, #4b5563)` }}>
                            Utilisation: Dry cleaning
                          </p>
                          <p className="mt-2 text-sm font-semibold" style={{ color: `color-mix(in srgb, ${primaryColor} 60%, #166534)` }}>
                            Paid: ₹382.00
                          </p>
                          <span
                            className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${primaryColor} 16%, white)`,
                              color: `color-mix(in srgb, ${primaryColor} 80%, #111827)`,
                            }}
                          >
                            Delivered
                          </span>
                        </div>
                      </div>

                      <div className="px-3 pb-3">
                        <div
                          className="relative flex h-[86px] items-end rounded-[30px] px-2.5 pb-2.5 pt-2 shadow-2xl"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <div className="flex flex-1 min-w-0">
                            <span className="flex flex-1 min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight text-white/80 transition-colors">
                              <Home className="h-[18px] w-[18px]" />
                              <span>Home</span>
                            </span>
                          </div>
                          <div className="flex flex-1 min-w-0">
                            <span className="flex flex-1 min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight text-white/80 transition-colors">
                              <ListOrdered className="h-[18px] w-[18px]" />
                              <span>Price list</span>
                            </span>
                          </div>
                          <div className="relative -mt-11 flex-[1.2]">
                            <span className="flex flex-col items-center">
                              <span
                                className="flex h-[58px] w-[58px] items-center justify-center rounded-full border-4 shadow-xl ring-2 ring-white/20"
                                style={{ backgroundColor: primaryColor, borderColor: '#ffffff' }}
                              >
                                <CalendarCheck2 className="h-6 w-6 text-white" />
                              </span>
                              <span className="mt-1.5 text-[11px] font-semibold text-white leading-none">Book Now</span>
                            </span>
                          </div>
                          <div className="flex flex-1 min-w-0">
                            <span className="flex flex-1 min-w-0 flex-col items-center gap-0.5 rounded-xl bg-white/22 px-1 py-2 text-[10px] font-semibold leading-tight text-white shadow-inner ring-1 ring-white/10">
                              <ClipboardList className="h-[18px] w-[18px]" />
                              <span>Orders</span>
                            </span>
                          </div>
                          <div className="flex flex-1 min-w-0">
                            <span className="flex flex-1 min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight text-white/80 transition-colors">
                              <UserRound className="h-[18px] w-[18px]" />
                              <span>Profile</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <FormField label="Terms and conditions (shown on this branch’s invoices)">
                <textarea
                  className={textareaClass}
                  rows={8}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  placeholder="Enter the legal / commercial terms that should print on PDF invoices for this branch."
                />
              </FormField>
              <Button type="submit" disabled={updateBranch.isPending || hasUniquenessConflict}>
                {updateBranch.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save details'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Branch logo</CardTitle>
          <p className="text-sm text-muted-foreground">Required before you can go live.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview ? (
            <img src={preview} alt="Branch logo" className="h-20 w-auto max-w-full object-contain object-left" />
          ) : (
            <p className="text-sm text-muted-foreground">No logo uploaded yet.</p>
          )}
          <div>
            <Input type="file" accept="image/*" onChange={handleLogo} disabled={uploadLogo.isPending} />
            {uploadLogo.isPending ? (
              <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Serviceable pincodes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add at least one active 6-digit pincode. Separate multiple with commas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {areasLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : areas.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet. Add pincodes below.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => (
                <span
                  key={a.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-medium shadow-sm',
                    a.active
                      ? 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-100'
                      : 'border-muted-foreground/25 bg-muted/60 text-muted-foreground',
                  )}
                >
                  <span>{a.pincode}</span>
                  {!a.active ? <span className="text-xs font-normal opacity-80">inactive</span> : null}
                  <button
                    type="button"
                    className={cn(
                      'ml-0.5 inline-flex rounded-full p-0.5 transition-colors',
                      a.active
                        ? 'text-sky-800 hover:bg-sky-200/90 dark:text-sky-200 dark:hover:bg-sky-800/80'
                        : 'hover:bg-muted',
                    )}
                    aria-label={`Remove pincode ${a.pincode}`}
                    disabled={deleteArea.isPending}
                    onClick={() => {
                      deleteArea.mutate(a.id, {
                        onSuccess: () => toast.success(`Removed ${a.pincode}`),
                        onError: (err) => toast.error(getApiError(err).message),
                      });
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={handleAddPincodes} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <FormField label="Pincodes" className="flex-1">
              <Input
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="560001 or 560001, 560002"
              />
            </FormField>
            <Button type="submit" variant="secondary" disabled={createArea.isPending}>
              {createArea.isPending ? 'Adding…' : 'Add'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {finishError ? <ErrorDisplay error={finishError} /> : null}
          {!canFinish ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
              {!hasLogo ? 'Upload a branch logo. ' : null}
              {pinCount < 1 ? 'Add at least one pincode. ' : null}
              {!mobileOk ? 'Enter a valid branch mobile number (10–15 digits) and save branch details. ' : null}
              {!effectiveTerms ? 'Add terms and conditions for this branch and save. ' : null}
            </p>
          ) : null}
          <form onSubmit={handleFinish}>
            <Button type="submit" disabled={!canFinish || finishing} className="w-full sm:w-auto">
              {finishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finishing…
                </>
              ) : (
                'Finish and go to dashboard'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
