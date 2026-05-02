'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { getStoredUser, setStoredUser, type AuthUser } from '@/lib/auth';
import { api, getApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { useBranch, useUpdateBranch, useBranchFieldUniquenessQuery } from '@/hooks/useBranches';
import { BranchUniquenessUnderField } from '@/components/branding/BranchFieldUniquenessHints';
import { HexColorPickField } from '@/components/branding/HexColorPickField';
import { useServiceAreas, useCreateServiceArea, useDeleteServiceArea } from '@/hooks/useServiceAreas';
import { toast } from 'sonner';
import { CalendarCheck2, ClipboardList, Home, ListOrdered, Loader2, UserRound, X } from 'lucide-react';

function phoneDigitsLen(s: string): number {
  return s.replace(/\D/g, '').length;
}

const branchSchema = z.object({
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
  gstNumber: z.string().max(32).optional(),
  panNumber: z.string().max(20).optional(),
  invoicePrefix: z.string().max(24).optional(),
  primaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Primary color must be a 6-digit hex like #0f3d91'),
  secondaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Secondary color must be a 6-digit hex like #e8f0ff'),
});

type OnboardingStep = 'colors' | 'details' | 'pincodes' | 'finish';

function onboardingStepMeta(step: OnboardingStep): { index: number; percent: number } {
  switch (step) {
    case 'colors':
      return { index: 1, percent: 25 };
    case 'details':
      return { index: 2, percent: 50 };
    case 'pincodes':
      return { index: 3, percent: 75 };
    case 'finish':
      return { index: 4, percent: 100 };
    default:
      return { index: 1, percent: 25 };
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const user = getStoredUser();
  const branchId = user?.branchId ?? null;
  const { data: branch, isLoading: branchLoading, error: branchError } = useBranch(branchId);
  const updateBranch = useUpdateBranch(branchId ?? '');
  const { data: areas = [], isLoading: areasLoading } = useServiceAreas(branchId ?? undefined);
  const createArea = useCreateServiceArea();
  const deleteArea = useDeleteServiceArea();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0f3d91');
  const [secondaryColor, setSecondaryColor] = useState('#e8f0ff');
  const [pinInput, setPinInput] = useState('');
  const [finishError, setFinishError] = useState<unknown>(null);
  const [finishing, setFinishing] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('colors');

  const uniqueness = useBranchFieldUniquenessQuery({
    excludeBranchId: branchId ?? undefined,
    name,
    invoicePrefix,
    itemTagBrandName: '',
    enabled: !!branchId,
  });

  useEffect(() => {
    if (branch) {
      setName(branch.name);
      setAddress(branch.address);
      setPhone(branch.phone ?? '');
      setGstNumber(branch.gstNumber ?? '');
      setPanNumber(branch.panNumber ?? '');
      setInvoicePrefix(branch.invoicePrefix ?? '');
      setPrimaryColor(branch.primaryColor ?? '#0f3d91');
      setSecondaryColor(branch.secondaryColor ?? '#e8f0ff');
    }
  }, [branch]);

  useEffect(() => {
    const u = getStoredUser();
    if (!u || u.role !== 'OPS' || !u.branchId) {
      router.replace('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flag = sessionStorage.getItem('onboarding_welcome');
    if (flag === '1') {
      sessionStorage.removeItem('onboarding_welcome');
      toast.success('Congrats! Your branch and account are created. Finish setup to go live.');
    }
  }, []);

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    const parsed = branchSchema.safeParse({
      name: name.trim(),
      address: address.trim(),
      mobile: phone.trim(),
      gstNumber: gstNumber.trim() || undefined,
      panNumber: panNumber.trim() || undefined,
      invoicePrefix: invoicePrefix.trim() || undefined,
      primaryColor: primaryColor.trim(),
      secondaryColor: secondaryColor.trim(),
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
    }
    updateBranch.mutate(
      {
        name: parsed.data.name,
        address: parsed.data.address,
        phone: parsed.data.mobile,
        gstNumber: parsed.data.gstNumber?.trim() || null,
        panNumber: parsed.data.panNumber?.trim() || null,
        invoicePrefix: parsed.data.invoicePrefix?.trim() || null,
        primaryColor: parsed.data.primaryColor.trim(),
        secondaryColor: parsed.data.secondaryColor.trim(),
      },
      {
        onSuccess: () => {
          toast.success('Branch details saved');
          setStep('pincodes');
        },
        onError: (err) => toast.error(getApiError(err).message),
      },
    );
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

  const pinCount = areas.filter((a) => a.active).length;
  const effectiveMobile = phone.trim() || branch?.phone?.trim() || '';
  const mobileOk = phoneDigitsLen(effectiveMobile) >= 10 && phoneDigitsLen(effectiveMobile) <= 15;
  const hasUniquenessConflict =
    !!uniqueness.data &&
    ((Boolean(name.trim()) && !uniqueness.data.name.available) ||
      (Boolean(invoicePrefix.trim()) && !uniqueness.data.invoicePrefix.available));
  const hasUnsavedColorChanges =
    !!branch &&
    (primaryColor.trim().toLowerCase() !== (branch.primaryColor ?? '').trim().toLowerCase() ||
      secondaryColor.trim().toLowerCase() !== (branch.secondaryColor ?? '').trim().toLowerCase());
  const canFinish = pinCount >= 1 && mobileOk && !hasUniquenessConflict;
  const stepMeta = onboardingStepMeta(step);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finish branch setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and save your branch profile (including GST, PAN, and invoice terms), upload your branch logo, add
          at least one serviceable pincode, then continue to the admin console.
        </p>
      </div>

      <div className={cn('grid items-start gap-6', step === 'colors' ? 'lg:grid-cols-[380px_minmax(0,1fr)]' : 'lg:grid-cols-1')}>
        {step === 'colors' ? (
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-lg">Customer app colors</CardTitle>
            <p className="text-sm text-muted-foreground">
              Finalise your brand colors here. This preview stays visible while you complete onboarding.
            </p>
            {hasUnsavedColorChanges ? (
              <p className="text-xs text-amber-700">Unsaved color changes. Click "Save details" on the right.</p>
            ) : (
              <p className="text-xs text-emerald-700">Colors are saved.</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <FormField label="Primary color (required)">
                <div className="flex items-center gap-2">
                  <HexColorPickField
                    value={primaryColor}
                    onChange={setPrimaryColor}
                    fallbackHex="#0f3d91"
                    ariaLabel="Pick primary colour"
                    presetVariant="primary"
                  />
                  <Input
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    placeholder="#0f3d91"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="min-w-0 flex-1 font-mono text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Main accent for customer app (buttons, active order cards, highlights).
                </p>
              </FormField>
              <FormField label="Secondary color (required)">
                <div className="flex items-center gap-2">
                  <HexColorPickField
                    value={secondaryColor}
                    onChange={setSecondaryColor}
                    fallbackHex="#e8f0ff"
                    ariaLabel="Pick secondary colour"
                    presetVariant="secondary"
                  />
                  <Input
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    placeholder="#e8f0ff"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="min-w-0 flex-1 font-mono text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Surface/tile background for customer app cards.
                </p>
              </FormField>
            </div>

            {step === 'colors' ? (
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
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Mockup preview is shown in Step 1 (Select colors). Selected colors are still applied.
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="mb-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{stepMeta.percent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stepMeta.percent}%`,
                      backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : '#2563eb',
                    }}
                  />
                </div>
              </div>
              <CardTitle className="text-lg">
                {step === 'colors' && 'Step 1 of 4: Select colors'}
                {step === 'details' && 'Step 2 of 4: Branch details'}
                {step === 'pincodes' && 'Step 3 of 4: Add pincodes'}
                {step === 'finish' && 'Step 4 of 4: Finish setup'}
              </CardTitle>
            </CardHeader>
          </Card>

          {step === 'colors' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Confirm colors</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pick your primary and secondary colors from the left panel, then continue.
                </p>
              </CardHeader>
              <CardContent>
                <Button type="button" onClick={() => setStep('details')}>
                  Next
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {step === 'details' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Branch details</CardTitle>
              </CardHeader>
              <CardContent>
                {branchLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <form onSubmit={handleSaveBranch} className="space-y-4">
                    <FormField label="Branch name *">
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
                    <FormField label="Address *">
                      <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                    </FormField>
                    <FormField label="Mobile number *">
                      <Input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+91 98765 43210 or 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
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
                    <FormField label="Invoice prefix (optional)">
                      <Input
                        value={invoicePrefix}
                        onChange={(e) => setInvoicePrefix(e.target.value)}
                        placeholder="e.g. TKS"
                        maxLength={24}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Used in invoice numbers. Keep this unique per branch.
                      </p>
                      <BranchUniquenessUnderField
                        slot={uniqueness.data?.invoicePrefix}
                        isEmpty={!invoicePrefix.trim()}
                        optionalEmptyHelp="Optional. If set, it must be unique across branches."
                        availableLabel="Available — this prefix is not used by another branch."
                        takenTemplate={(other) =>
                          `This prefix is already used by "${other}". Use a different prefix for each branch.`
                        }
                      />
                    </FormField>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setStep('colors')}>
                        Back
                      </Button>
                      <Button type="submit" disabled={updateBranch.isPending || hasUniquenessConflict}>
                        {updateBranch.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                          </>
                        ) : (
                          'Save and next'
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : null}

          {step === 'pincodes' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Serviceable pincodes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add at least one active 6-digit pincode. Separate multiple with commas.
                </p>
                <p className="text-xs text-blue-700">
                  You can add more pincodes later from the Service Areas page.
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
                  <FormField label="Pincodes *" className="flex-1">
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
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep('details')}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep('finish')}
                    disabled={pinCount < 1}
                    title={pinCount < 1 ? 'Add at least one pincode to continue' : undefined}
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 'finish' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Complete</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {finishError ? <ErrorDisplay error={finishError} /> : null}
                {!canFinish ? (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                    {pinCount < 1 ? 'Add at least one pincode. ' : null}
                    {!mobileOk ? 'Enter a valid branch mobile number (10–15 digits) and save branch details. ' : null}
                  </p>
                ) : null}
                <form onSubmit={handleFinish} className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep('pincodes')}>
                    Back
                  </Button>
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
