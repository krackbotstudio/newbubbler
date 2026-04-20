'use client';

import { useState, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { useCreateBranch, useUpdateBranch, useUploadBranchUpiQr, useBranchFieldUniquenessQuery } from '@/hooks/useBranches';
import { BranchUniquenessUnderField } from '@/components/branding/BranchFieldUniquenessHints';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/api';
import type { Branch } from '@/types';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  gstNumber: z.string().nullable(),
  panNumber: z.string().nullable(),
  invoicePrefix: z.string().max(24).nullable(),
  itemTagBrandName: z.string().max(40).nullable(),
  primaryColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).nullable(),
  secondaryColor: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).nullable(),
  upiId: z.string().nullable(),
  upiPayeeName: z.string().nullable(),
  upiLink: z.string().nullable(),
  footerNote: z.string().nullable(),
});

type FormValues = z.infer<typeof schema>;

interface BranchFormModalProps {
  branch: Branch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
}

export function BranchFormModal({ branch, open, onOpenChange, mode }: BranchFormModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [itemTagBrandName, setItemTagBrandName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#D94680');
  const [secondaryColor, setSecondaryColor] = useState('#FCE7F3');
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiLink, setUpiLink] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [isMainBranch, setIsMainBranch] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);

  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch(branch?.id ?? '');
  const uploadUpiQr = useUploadBranchUpiQr(branch?.id ?? '');

  const excludeBranchId = useMemo(
    () => (mode === 'edit' && branch?.id ? branch.id : null),
    [mode, branch?.id],
  );
  const uniqueness = useBranchFieldUniquenessQuery({
    excludeBranchId,
    name,
    invoicePrefix,
    itemTagBrandName,
    enabled: open,
  });

  useEffect(() => {
    if (mode === 'edit' && branch) {
      setName(branch.name);
      setAddress(branch.address);
      setPhone(branch.phone ?? '');
      setEmail(branch.email ?? '');
      setGstNumber(branch.gstNumber ?? '');
      setPanNumber(branch.panNumber ?? '');
      setInvoicePrefix(branch.invoicePrefix ?? '');
      setItemTagBrandName(branch.itemTagBrandName ?? '');
      setPrimaryColor(branch.primaryColor ?? '#D94680');
      setSecondaryColor(branch.secondaryColor ?? '#FCE7F3');
      setUpiId(branch.upiId ?? '');
      setUpiPayeeName(branch.upiPayeeName ?? '');
      setUpiLink(branch.upiLink ?? '');
      setFooterNote(branch.footerNote ?? '');
      setIsMainBranch(branch.isDefault ?? false);
    } else if (mode === 'add') {
      setName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setGstNumber('');
      setPanNumber('');
      setInvoicePrefix('');
      setItemTagBrandName('');
      setPrimaryColor('#D94680');
      setSecondaryColor('#FCE7F3');
      setUpiId('');
      setUpiPayeeName('');
      setUpiLink('');
      setFooterNote('');
      setIsMainBranch(false);
    }
    setQrFile(null);
  }, [mode, branch, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      gstNumber: gstNumber.trim() || null,
      panNumber: panNumber.trim() || null,
      invoicePrefix: invoicePrefix.trim() || null,
      itemTagBrandName: itemTagBrandName.trim() || null,
      primaryColor: primaryColor.trim() || null,
      secondaryColor: secondaryColor.trim() || null,
      upiId: upiId.trim() || null,
      upiPayeeName: upiPayeeName.trim() || null,
      upiLink: upiLink.trim() || null,
      footerNote: footerNote.trim() || null,
    });
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors?.name?.[0]
        ?? result.error.flatten().fieldErrors?.address?.[0]
        ?? result.error.message;
      toast.error(msg);
      return;
    }
    const u = uniqueness.data;
    if (u) {
      if (result.data.name.trim() && !u.name.available) {
        toast.error('Choose a unique branch name (see hint below the field).');
        return;
      }
      if (result.data.invoicePrefix?.trim() && !u.invoicePrefix.available) {
        toast.error('Choose a unique invoice prefix not used by another branch.');
        return;
      }
      if (result.data.itemTagBrandName?.trim() && !u.itemTagBrandName.available) {
        toast.error('Choose a unique short brand on item tag not used by another branch.');
        return;
      }
    }
    const body = {
      name: result.data.name,
      address: result.data.address,
      phone: result.data.phone,
      email: result.data.email,
      gstNumber: result.data.gstNumber,
      panNumber: result.data.panNumber,
      invoicePrefix: result.data.invoicePrefix,
      itemTagBrandName: result.data.itemTagBrandName,
      primaryColor: result.data.primaryColor,
      secondaryColor: result.data.secondaryColor,
      upiId: result.data.upiId,
      upiPayeeName: result.data.upiPayeeName,
      upiLink: result.data.upiLink,
      footerNote: result.data.footerNote,
      isDefault: isMainBranch,
    };
    if (mode === 'add') {
      createBranch.mutate(body, {
        onSuccess: () => {
          toast.success('Branch added');
          onOpenChange(false);
        },
        onError: (err) => toast.error(getFriendlyErrorMessage(err)),
      });
    } else if (branch) {
      updateBranch.mutate(body, {
        onSuccess: () => {
          if (qrFile) {
            uploadUpiQr.mutate(qrFile, {
              onSuccess: () => {
                toast.success('Branch updated');
                onOpenChange(false);
              },
              onError: (err) => toast.error(getFriendlyErrorMessage(err)),
            });
          } else {
            toast.success('Branch updated');
            onOpenChange(false);
          }
        },
        onError: (err) => toast.error(getFriendlyErrorMessage(err)),
      });
    }
  };

  const hasUniquenessConflict =
    !!uniqueness.data &&
    ((Boolean(name.trim()) && !uniqueness.data.name.available) ||
      (Boolean(invoicePrefix.trim()) && !uniqueness.data.invoicePrefix.available) ||
      (Boolean(itemTagBrandName.trim()) && !uniqueness.data.itemTagBrandName.available));
  const isPending = createBranch.isPending || updateBranch.isPending || uploadUpiQr.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === 'add' ? 'Add branch' : 'Edit branch'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <FormField label="Branch name" htmlFor="branch-name">
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Branch name"
              />
              <BranchUniquenessUnderField
                slot={uniqueness.data?.name}
                isEmpty={!name.trim()}
                availableLabel="Available — no other branch uses this name (case-insensitive)."
                takenTemplate={(other) =>
                  `This name matches "${other}". Each branch must have a distinct name (case-insensitive).`
                }
              />
            </FormField>
            <FormField label="Address" htmlFor="branch-address">
              <Input
                id="branch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
              />
            </FormField>
            <FormField label="Phone (optional)" htmlFor="branch-phone">
              <Input
                id="branch-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
              />
            </FormField>
            <FormField label="Email (optional)" htmlFor="branch-email">
              <Input
                id="branch-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="branch@example.com"
              />
            </FormField>
            <FormField label="GST number (optional)" htmlFor="branch-gst">
              <Input
                id="branch-gst"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="e.g. 36AABCU9603R1ZM"
              />
            </FormField>
            <FormField label="PAN number (optional)" htmlFor="branch-pan">
              <Input
                id="branch-pan"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value)}
                placeholder="e.g. ABCDU9603R"
              />
            </FormField>
            <FormField label="Invoice prefix (optional)" htmlFor="branch-inv-prefix">
              <Input
                id="branch-inv-prefix"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="Used in ACK / Final invoice codes"
                maxLength={24}
              />
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
            <FormField label="Short brand on item tag (optional)" htmlFor="branch-tag-brand">
              <Input
                id="branch-tag-brand"
                value={itemTagBrandName}
                onChange={(e) => setItemTagBrandName(e.target.value)}
                placeholder="Printed on garment tags"
                maxLength={40}
              />
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
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Primary color (hex)" htmlFor="branch-primary-color">
                <div className="flex items-center gap-2">
                  <Input
                    id="branch-primary-color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-16 p-1"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#D94680"
                    maxLength={7}
                  />
                </div>
              </FormField>
              <FormField label="Secondary color (hex)" htmlFor="branch-secondary-color">
                <div className="flex items-center gap-2">
                  <Input
                    id="branch-secondary-color"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-16 p-1"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#FCE7F3"
                    maxLength={7}
                  />
                </div>
              </FormField>
            </div>
            <FormField label="Payment UPI ID (optional)" htmlFor="branch-upi">
              <Input
                id="branch-upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. business@upi"
              />
            </FormField>
            <FormField label="UPI payee name (optional)" htmlFor="branch-upi-name">
              <Input
                id="branch-upi-name"
                value={upiPayeeName}
                onChange={(e) => setUpiPayeeName(e.target.value)}
                placeholder="Display name for UPI"
              />
            </FormField>
            <FormField label="UPI link (optional)" htmlFor="branch-upi-link">
              <Input
                id="branch-upi-link"
                value={upiLink}
                onChange={(e) => setUpiLink(e.target.value)}
                placeholder="https://..."
              />
            </FormField>
            {mode === 'edit' && branch && (
              <FormField label="Payment UPI QR (optional)" htmlFor="branch-qr">
                <div className="space-y-2">
                  {branch.upiQrUrl && (
                    <p className="text-xs text-muted-foreground">Current: {branch.upiQrUrl}</p>
                  )}
                  <input
                    id="branch-qr"
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                    onChange={(e) => setQrFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </FormField>
            )}
            <FormField label="Footer note (optional)" htmlFor="branch-footer">
              <Input
                id="branch-footer"
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                placeholder="Footer note"
              />
            </FormField>
            <div className="flex items-center gap-2">
              <input
                id="branch-main"
                type="checkbox"
                checked={isMainBranch}
                onChange={(e) => setIsMainBranch(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="branch-main" className="text-sm font-medium cursor-pointer">
                Set as main branch
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || hasUniquenessConflict}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'add' ? 'Add' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
