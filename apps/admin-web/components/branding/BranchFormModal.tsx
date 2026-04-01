'use client';

import { useState, useEffect } from 'react';
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
import { useCreateBranch, useUpdateBranch, useUploadBranchUpiQr } from '@/hooks/useBranches';
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
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiLink, setUpiLink] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [isMainBranch, setIsMainBranch] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);

  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch(branch?.id ?? '');
  const uploadUpiQr = useUploadBranchUpiQr(branch?.id ?? '');

  useEffect(() => {
    if (mode === 'edit' && branch) {
      setName(branch.name);
      setAddress(branch.address);
      setPhone(branch.phone ?? '');
      setEmail(branch.email ?? '');
      setGstNumber(branch.gstNumber ?? '');
      setPanNumber(branch.panNumber ?? '');
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
    const body = {
      name: result.data.name,
      address: result.data.address,
      phone: result.data.phone,
      email: result.data.email,
      gstNumber: result.data.gstNumber,
      panNumber: result.data.panNumber,
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
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'add' ? 'Add' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
