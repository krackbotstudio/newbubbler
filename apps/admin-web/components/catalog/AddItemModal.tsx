'use client';

import { useState } from 'react';
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
import { useCreateItem } from '@/hooks/useCatalog';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/api';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { catalogIcons } from '@/constants/catalogIcons';
import { CatalogItemIcon, isPresetIcon } from './CatalogItemIcon';
import { useUploadCatalogIcon } from '@/hooks/useCatalog';

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddItemModal({ open, onOpenChange }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [icon, setIcon] = useState<string | ''>('');
  const [error, setError] = useState<unknown>(null);
  const createItem = useCreateItem();
  const uploadCatalogIcon = useUploadCatalogIcon();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setError(null);
    createItem.mutate(
      { name: name.trim(), active, icon: icon || null },
      {
        onSuccess: () => {
          toast.success('Item added');
          setName('');
          setActive(true);
          setIcon('');
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => {
          setError(err);
          toast.error(getFriendlyErrorMessage(err));
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
          </DialogHeader>
          {error ? <ErrorDisplay error={error} /> : null}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="add-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="add-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Icon (optional) — one per item</label>
              <div className="flex flex-wrap items-end gap-3">
                <Select
                  value={isPresetIcon(icon) ? icon : ''}
                  onValueChange={(v) => setIcon(v)}
                >
                  <SelectTrigger className="w-[220px] flex flex-row items-center">
                    <span className="inline-flex flex-1 min-w-0 flex-row items-center gap-2 flex-nowrap">
                      {icon ? (
                        <>
                          <CatalogItemIcon icon={icon} size={18} className="shrink-0" />
                          <span className="truncate">
                            {isPresetIcon(icon)
                              ? catalogIcons.find((c) => c.value === icon)?.label ?? icon
                              : 'Custom image'}
                          </span>
                        </>
                      ) : (
                        <SelectValue placeholder="Select icon" />
                      )}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {catalogIcons.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <CatalogItemIcon icon={opt.value} size={18} className="shrink-0" />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Or upload PNG/JPG</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    className="text-sm file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      uploadCatalogIcon.mutate(file, {
                        onSuccess: (url) => {
                          setIcon(url);
                          toast.success('Icon uploaded');
                        },
                        onError: (err) => {
                          toast.error(getFriendlyErrorMessage(err));
                        },
                      });
                      e.target.value = '';
                    }}
                    disabled={uploadCatalogIcon.isPending}
                  />
                </div>
              </div>
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
            <Button type="submit" disabled={createItem.isPending}>
              {createItem.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
