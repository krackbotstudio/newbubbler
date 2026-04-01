'use client';

import { useState } from 'react';
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
import { useCreateServiceArea } from '@/hooks/useServiceAreas';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';
import { getApiError } from '@/lib/api';

const addPincodeSchema = z.object({
  branchId: z.string().min(1, 'Select a branch'),
  active: z.boolean(),
});

type AddPincodeFormValues = z.infer<typeof addPincodeSchema>;

interface AddPincodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPincodeModal({ open, onOpenChange }: AddPincodeModalProps) {
  const [pincodeInput, setPincodeInput] = useState('');
  const [branchId, setBranchId] = useState('');
  const [active, setActive] = useState(true);
  const createArea = useCreateServiceArea();
  const { data: branches = [] } = useBranches();

  const parsePincodes = (input: string) => {
    const tokens = input
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(tokens));
    const valid = unique.filter((p) => /^\d{6}$/.test(p));
    const invalid = unique.filter((p) => !/^\d{6}$/.test(p));
    return { valid, invalid };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = addPincodeSchema.safeParse({ branchId: branchId || undefined, active });
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors.branchId?.[0]
        ?? result.error.message;
      toast.error(msg);
      return;
    }
    const parsed = parsePincodes(pincodeInput);
    if (parsed.valid.length === 0) {
      toast.error('Enter at least one valid 6-digit pincode. For bulk, separate by comma.');
      return;
    }
    if (parsed.invalid.length > 0) {
      toast.error(`Invalid pincodes: ${parsed.invalid.join(', ')}`);
      return;
    }
    if (!branchId) {
      toast.error('Select a branch');
      return;
    }
    const failed: string[] = [];
    let successCount = 0;
    for (const pin of parsed.valid) {
      try {
        await createArea.mutateAsync({ pincode: pin, branchId, active });
        successCount += 1;
      } catch (err) {
        const apiErr = getApiError(err);
        if (apiErr.code === 'PINCODE_ALREADY_IN_OTHER_BRANCH') {
          failed.push(`${pin} (already in another branch)`);
        } else {
          failed.push(`${pin} (${apiErr.message})`);
        }
      }
    }

    if (successCount > 0 && failed.length === 0) {
      toast.success(successCount === 1 ? 'Pincode added' : `${successCount} pincodes added`);
      setPincodeInput('');
      setBranchId('');
      setActive(true);
      onOpenChange(false);
      return;
    }
    if (successCount > 0) {
      toast.success(`${successCount} pincodes added, ${failed.length} failed`);
      toast.error(`Failed: ${failed.slice(0, 4).join(' | ')}${failed.length > 4 ? ' ...' : ''}`);
      setPincodeInput('');
      setBranchId('');
      setActive(true);
      onOpenChange(false);
      return;
    }
    toast.error(`Could not add pincodes: ${failed.slice(0, 4).join(' | ')}${failed.length > 4 ? ' ...' : ''}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add pincode</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="add-branch" className="text-sm font-medium">
                Branch
              </label>
              <select
                id="add-branch"
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
            </div>
            <div className="grid gap-2">
              <label htmlFor="add-pincode" className="text-sm font-medium">
                Pincode(s)
              </label>
              <Input
                id="add-pincode"
                value={pincodeInput}
                onChange={(e) => setPincodeInput(e.target.value)}
                placeholder="110001, 500081, 500082"
              />
              <p className="text-xs text-muted-foreground">
                Enter one or more 6-digit pincodes separated by commas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="add-active" checked={active} onCheckedChange={setActive} />
              <label htmlFor="add-active" className="text-sm font-medium">
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createArea.isPending}>
              {createArea.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
