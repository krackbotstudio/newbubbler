'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { useBranch, useUpdateBranch, useUploadBranchLogo, useUploadBranchUpiQr, useBranchFieldUniquenessQuery } from '@/hooks/useBranches';
import { BranchUniquenessUnderField } from '@/components/branding/BranchFieldUniquenessHints';
import { getApiOrigin, getApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function imageUrl(url: string | null, cacheBuster?: string | null): string | null {
  if (!url) return null;
  const full = url.startsWith('http') ? url : `${getApiOrigin()}${url.startsWith('/') ? '' : '/'}${url}`;
  if (!cacheBuster) return full;
  return `${full}${full.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheBuster)}`;
}

const textareaClass = cn(
  'flex min-h-[120px] w-full rounded-md border border-pink-200 bg-pink-50 px-3 py-2 text-sm text-pink-700 ring-offset-background placeholder:font-normal placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-pink-950/30 dark:border-pink-800 dark:text-pink-300 dark:placeholder:text-gray-400',
);

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
        'Enter a valid mobile number (10–15 digits)',
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
    termsAndConditions: z.string().trim().min(1, 'Terms and conditions are required for invoices'),
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

export function OpsBranchBrandingView({ branchId }: { branchId: string }) {
  const { data: branch, isLoading, error } = useBranch(branchId);
  const updateBranch = useUpdateBranch(branchId);
  const uploadLogo = useUploadBranchLogo(branchId);
  const uploadUpiQr = useUploadBranchUpiQr(branchId);

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
  const [termsAndConditions, setTermsAndConditions] = useState('');

  const uniqueness = useBranchFieldUniquenessQuery({
    excludeBranchId: branchId,
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
      setTermsAndConditions(branch.termsAndConditions ?? '');
    }
  }, [branch]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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
        termsAndConditions: parsed.data.termsAndConditions.trim(),
      },
      {
        onSuccess: () => toast.success('Branch saved'),
        onError: (err) => toast.error(getApiError(err).message),
      },
    );
  };

  const handleLogo = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    uploadLogo.mutate(file, {
      onSuccess: () => {
        toast.success('Logo uploaded');
        ev.target.value = '';
      },
      onError: (err) => toast.error(getApiError(err).message),
    });
  };

  const handleUpiQr = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    uploadUpiQr.mutate(file, {
      onSuccess: () => {
        toast.success('UPI QR uploaded');
        ev.target.value = '';
      },
      onError: (err) => toast.error(getApiError(err).message),
    });
  };

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Branch branding</h1>
        <p className="text-sm text-destructive">Could not load your branch.</p>
      </div>
    );
  }

  if (isLoading || !branch) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading branch…
      </div>
    );
  }

  const v = branch.updatedAt;
  const logoPreview = imageUrl(branch.logoUrl, v);
  const qrPreview = imageUrl(branch.upiQrUrl, v);
  const hasUniquenessConflict =
    !!uniqueness.data &&
    ((Boolean(name.trim()) && !uniqueness.data.name.available) ||
      (Boolean(invoicePrefix.trim()) && !uniqueness.data.invoicePrefix.available) ||
      (Boolean(itemTagBrandName.trim()) && !uniqueness.data.itemTagBrandName.available));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Branch branding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Logo, contact, GST/PAN, UPI, and invoice terms for your branch only. Global brand settings are managed by
          head office.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branch details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 max-w-xl">
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
              <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormField>
            <FormField label="Public branch email (optional)">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="GST (optional)">
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
                <p className="mt-1 text-xs text-muted-foreground">Included in ACK / Final invoice codes for this branch.</p>
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
              <FormField label="Short brand on item tag (optional)">
                <Input
                  value={itemTagBrandName}
                  onChange={(e) => setItemTagBrandName(e.target.value)}
                  placeholder="e.g. TKS"
                  maxLength={40}
                />
                <p className="mt-1 text-xs text-muted-foreground">Used on printed tags; otherwise branch / company name.</p>
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
              <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} />
            </FormField>
            <FormField label="UPI payee name (optional)">
              <Input value={upiPayeeName} onChange={(e) => setUpiPayeeName(e.target.value)} />
            </FormField>
            <FormField label="UPI payment link (optional)">
              <Input type="url" value={upiLink} onChange={(e) => setUpiLink(e.target.value)} />
            </FormField>
            <FormField label="Terms and conditions (on invoices)">
              <textarea
                className={textareaClass}
                rows={6}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
              />
            </FormField>
            <Button type="submit" disabled={updateBranch.isPending || hasUniquenessConflict}>
              {updateBranch.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branch logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="h-24 w-auto max-w-full object-contain object-left" />
          ) : null}
          <Input type="file" accept="image/*" onChange={handleLogo} disabled={uploadLogo.isPending} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branch UPI QR</CardTitle>
          <p className="text-sm text-muted-foreground">Optional — for payments specific to this branch.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrPreview ? (
            <img src={qrPreview} alt="UPI QR" className="h-36 w-36 object-contain" />
          ) : null}
          <Input type="file" accept="image/*" onChange={handleUpiQr} disabled={uploadUpiQr.isPending} />
        </CardContent>
      </Card>
    </div>
  );
}
