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
import { Switch } from '@/components/ui/switch';
import { usePatchServiceArea, useCreateServiceArea, useDeleteServiceArea } from '@/hooks/useServiceAreas';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';
import { getApiError } from '@/lib/api';
import type { ServiceArea } from '@/types';

const editPincodeSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  branchId: z.string().min(1, 'Select a branch'),
  active: z.boolean(),
});

interface EditPincodeModalProps {
  area: ServiceArea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Branch head: cannot move pincode to another branch. */
  lockedBranchId?: string | null;
}

export function EditPincodeModal({ area, open, onOpenChange, lockedBranchId = null }: EditPincodeModalProps) {
  const [pincode, setPincode] = useState('');
  const [branchId, setBranchId] = useState('');
  const [active, setActive] = useState(true);
  const patchArea = usePatchServiceArea(area?.id ?? '');
  const createArea = useCreateServiceArea();
  const deleteArea = useDeleteServiceArea();
  const { data: branches = [] } = useBranches();

  useEffect(() => {
    if (open && area) {
      setPincode(area.pincode);
      setBranchId(lockedBranchId ?? area.branchId);
      setActive(area.active);
    }
  }, [open, area, lockedBranchId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!area) return;
    const result = editPincodeSchema.safeParse({ pincode: pincode.trim(), branchId: branchId || undefined, active });
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors.pincode?.[0]
        ?? result.error.flatten().fieldErrors.branchId?.[0]
        ?? result.error.message;
      toast.error(msg);
      return;
    }
    if (!branchId) {
      toast.error('Select a branch');
      return;
    }
    const pincodeChanged = result.data.pincode !== area.pincode;
    if (pincodeChanged) {
      deleteArea.mutate(area.id, {
        onSuccess: () => {
          createArea.mutate({ pincode: result.data.pincode, branchId, active }, {
            onSuccess: () => {
              toast.success('Pincode updated');
              onOpenChange(false);
            },
            onError: (err) => {
              const apiErr = getApiError(err);
              if (apiErr.code === 'PINCODE_ALREADY_IN_OTHER_BRANCH') {
                toast.error('That branch already has this pincode.');
              } else {
                toast.error(apiErr.message);
              }
            },
          });
        },
        onError: (err) => {
          toast.error(getApiError(err).message);
        },
      });
    } else {
      const patch: { branchId?: string; active?: boolean } = {};
      if (branchId !== area.branchId) patch.branchId = branchId;
      if (active !== area.active) patch.active = active;
      if (Object.keys(patch).length === 0) {
        onOpenChange(false);
        return;
      }
      patchArea.mutate(patch, {
        onSuccess: () => {
          toast.success('Service area updated');
          onOpenChange(false);
        },
        onError: (err) => {
          const apiErr = getApiError(err);
          if (apiErr.code === 'PINCODE_ALREADY_IN_OTHER_BRANCH') {
            toast.error('That branch already has this pincode.');
          } else {
            toast.error(apiErr.message);
          }
        },
      });
    }
  };

  const isPending = patchArea.isPending || createArea.isPending || deleteArea.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit pincode</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="edit-branch" className="text-sm font-medium">
                Branch
              </label>
              {lockedBranchId ? (
                <p id="edit-branch" className="text-sm rounded-md border border-input bg-muted/40 px-3 py-2">
                  {branches.find((b) => b.id === lockedBranchId)?.name ?? lockedBranchId}
                </p>
              ) : (
                <select
                  id="edit-branch"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required
                >
                  <option value="">Select branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-pincode" className="text-sm font-medium">
                Pincode (6 digits)
              </label>
              <Input
                id="edit-pincode"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="110001"
              />
              <p className="text-xs text-muted-foreground">
                Changing the pincode will remove the old entry and create a new one.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="edit-active" checked={active} onCheckedChange={setActive} />
              <label htmlFor="edit-active" className="text-sm font-medium">
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
