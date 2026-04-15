'use client';

import { useState, useEffect, useMemo } from 'react';
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
import {
  useUpdateItemWithMatrix,
  useCreateServiceCategory,
  useCreateSegmentCategory,
} from '@/hooks/useCatalog';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/api';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import type {
  CatalogItemWithMatrix,
  ServiceCategory,
  SegmentCategory,
  SegmentPriceInput,
} from '@/types';
import { Trash2, Plus } from 'lucide-react';
import { CatalogItemIcon } from './CatalogItemIcon';
import { useUploadCatalogIcon } from '@/hooks/useCatalog';

interface PriceLineRow {
  id: string;
  segmentCategoryId: string;
  serviceCategoryId: string;
  priceRupees: number | '';
  isActive: boolean;
}

function nextId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDuplicateKeys(rows: PriceLineRow[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const r of rows) {
    if (!r.segmentCategoryId || !r.serviceCategoryId) continue;
    const key = `${r.segmentCategoryId}-${r.serviceCategoryId}`;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }
  return duplicates;
}

function mergeUniqueById<T extends { id: string; label?: string; code?: string }>(base: T[], extra: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of [...base, ...extra]) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

interface EditItemModalProps {
  item: CatalogItemWithMatrix | null;
  serviceCategories: ServiceCategory[];
  segmentCategories: SegmentCategory[];
  /** Branch whose segment/service taxonomy is used when creating new categories from this dialog. */
  taxonomyBranchId: string;
  /** When set (branch head), branch assignment is limited to this branch; server merges with other branches. */
  branchHeadBranchId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditItemModal({
  item,
  serviceCategories,
  segmentCategories,
  taxonomyBranchId,
  branchHeadBranchId = null,
  open,
  onOpenChange,
}: EditItemModalProps) {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [icon, setIcon] = useState<string | ''>('');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [rows, setRows] = useState<PriceLineRow[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [localCategories, setLocalCategories] = useState<ServiceCategory[]>([]);
  const [localSegments, setLocalSegments] = useState<SegmentCategory[]>([]);
  const [iconCacheBuster, setIconCacheBuster] = useState<string>('');

  const updateMatrix = useUpdateItemWithMatrix(item?.id ?? '');
  const createCategory = useCreateServiceCategory();
  const createSegment = useCreateSegmentCategory();
  const uploadCatalogIcon = useUploadCatalogIcon();
  const { data: branches = [] } = useBranches();
  const myBranchLabel = useMemo(() => {
    if (!branchHeadBranchId) return '';
    return branches.find((b) => b.id === branchHeadBranchId)?.name ?? branchHeadBranchId;
  }, [branchHeadBranchId, branches]);

  const categories = useMemo(
    () => mergeUniqueById(serviceCategories, localCategories),
    [serviceCategories, localCategories],
  );
  const segments = useMemo(
    () => mergeUniqueById(segmentCategories, localSegments),
    [segmentCategories, localSegments],
  );

  useEffect(() => {
    if (item && open) {
      setName(item.name);
      setActive(item.active);
      setIcon(item.icon ?? '');
      setBranchIds(item.branchIds ?? []);
      setRows(
        item.segmentPrices.map((p) => ({
          id: nextId(),
          segmentCategoryId: p.segmentCategoryId,
          serviceCategoryId: p.serviceCategoryId,
          priceRupees: p.priceRupees,
          isActive: p.isActive,
        })),
      );
      setError(null);
      setLocalCategories([]);
      setLocalSegments([]);
      setIconCacheBuster(item.updatedAt ?? '');
    }
  }, [item?.id, open]);

  const duplicateKeys = useMemo(() => getDuplicateKeys(rows), [rows]);
  const hasDuplicates = duplicateKeys.size > 0;

  const updateRow = (id: string, patch: Partial<PriceLineRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addPriceLine = () => {
    const firstSegment = segments[0]?.id ?? '';
    const firstCategory = categories[0]?.id ?? '';
    setRows((prev) => [
      ...prev,
      {
        id: nextId(),
        segmentCategoryId: firstSegment,
        serviceCategoryId: firstCategory,
        priceRupees: '',
        isActive: true,
      },
    ]);
  };

  const buildSegmentPrices = (): SegmentPriceInput[] => {
    return rows
      .filter((r) => r.segmentCategoryId && r.serviceCategoryId)
      .map((r) => ({
        segmentCategoryId: r.segmentCategoryId,
        serviceCategoryId: r.serviceCategoryId,
        priceRupees: r.priceRupees === '' ? 0 : Math.max(0, Math.floor(Number(r.priceRupees))),
        isActive: r.isActive,
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (hasDuplicates) {
      toast.error('Remove duplicate segment + service combinations');
      return;
    }
    setError(null);
    const segmentPrices = buildSegmentPrices();
    const branchIdsForSave =
      branchHeadBranchId != null && branchHeadBranchId !== ''
        ? [...new Set([...branchIds.filter((id) => id !== branchHeadBranchId), branchHeadBranchId])]
        : branchIds;
    updateMatrix.mutate(
      { name: name.trim(), active, icon: icon || null, branchIds: branchIdsForSave, segmentPrices },
      {
        onSuccess: () => {
          toast.success('Item updated');
          onOpenChange(false);
        },
        onError: (err) => {
          setError(err);
          toast.error(getFriendlyErrorMessage(err));
        },
      },
    );
  };

  const handleAddServiceCategory = () => {
    const name = newServiceName.trim();
    if (!name) {
      toast.error('Enter a name for the service');
      return;
    }
    if (!taxonomyBranchId.trim()) {
      toast.error('Select a catalog branch (or add a branch) before creating services.');
      return;
    }
    const code = name.toUpperCase().replace(/\s+/g, '_');
    const label = name;
    createCategory.mutate(
      { code, label, branchId: taxonomyBranchId.trim() },
      {
        onSuccess: (data) => {
          setLocalCategories((prev) => {
            if (prev.some((c) => c.id === data.id)) return prev;
            return [...prev, { ...data, createdAt: new Date().toISOString() } as ServiceCategory];
          });
          setNewServiceName('');
          toast.success('Service category added');
        },
        onError: (err) => {
          toast.error(getFriendlyErrorMessage(err));
        },
      },
    );
  };

  const handleAddSegment = () => {
    const name = newSegmentName.trim();
    if (!name) {
      toast.error('Enter a name for the segment');
      return;
    }
    if (!taxonomyBranchId.trim()) {
      toast.error('Select a catalog branch (or add a branch) before creating segments.');
      return;
    }
    const code = name.toUpperCase().replace(/\s+/g, '_');
    const label = name;
    createSegment.mutate(
      { code, label, branchId: taxonomyBranchId.trim() },
      {
        onSuccess: (data) => {
          setLocalSegments((prev) => {
            if (prev.some((s) => s.id === data.id)) return prev;
            return [...prev, { ...data, createdAt: new Date().toISOString() } as SegmentCategory];
          });
          setNewSegmentName('');
          toast.success('Segment added');
        },
        onError: (err) => {
          toast.error(getFriendlyErrorMessage(err));
        },
      },
    );
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit item — {item.name}</DialogTitle>
          </DialogHeader>
          {error ? <ErrorDisplay error={error} className="shrink-0" /> : null}
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto py-4">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="edit-name" className="text-sm font-medium sr-only">
                    Name
                  </label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Item name"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch id="edit-active" checked={active} onCheckedChange={setActive} />
                <label htmlFor="edit-active" className="text-sm font-medium whitespace-nowrap">
                  Active
                </label>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">{branchHeadBranchId ? 'Branch' : 'Branches'}</label>
              {branchHeadBranchId ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-foreground">
                  {myBranchLabel || branchHeadBranchId}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="branch-mode"
                        checked={branchIds.length === 0}
                        onChange={() => setBranchIds([])}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Served in all branches</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="branch-mode"
                        checked={branchIds.length > 0}
                        onChange={() => setBranchIds(branches.length > 0 ? [branches[0].id] : [])}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Specific branches only</span>
                    </label>
                  </div>
                  {branchIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 rounded-md border p-2">
                      {branches.map((b) => (
                        <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={branchIds.includes(b.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBranchIds((prev) => [...prev, b.id]);
                              } else {
                                setBranchIds((prev) => prev.filter((id) => id !== b.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-input"
                          />
                          {b.name}
                        </label>
                      ))}
                      {branches.length === 0 && (
                        <span className="text-muted-foreground text-sm">No branches. Add branches in Branding.</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Icon (optional) — one per item</label>
              <div className="flex flex-wrap items-center gap-3">
                {icon && (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
                    <CatalogItemIcon icon={icon} size={22} cacheBuster={iconCacheBuster} />
                  </span>
                )}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  className="text-sm file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    uploadCatalogIcon.mutate({ file, key: item?.id }, {
                      onSuccess: (url) => {
                        setIcon(url);
                        setIconCacheBuster(String(Date.now()));
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
                {icon && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setIcon('')}
                  >
                    Remove icon
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="new-segment-name" className="text-sm font-medium whitespace-nowrap">
                  Add segment
                </label>
                <Input
                  id="new-segment-name"
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  placeholder="Name"
                  className="w-36"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSegment())}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleAddSegment}
                  disabled={createSegment.isPending || !newSegmentName.trim()}
                  title="Add segment"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="new-service-name" className="text-sm font-medium whitespace-nowrap">
                  Add service
                </label>
                <Input
                  id="new-service-name"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Name"
                  className="w-36"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddServiceCategory())}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleAddServiceCategory}
                  disabled={createCategory.isPending || !newServiceName.trim()}
                  title="Add service category"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Pricing lines</p>
              </div>
              {hasDuplicates && (
                <p className="text-xs text-destructive">Duplicate segment + service in rows. Remove duplicates to save.</p>
              )}
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Segment</th>
                      <th className="text-left p-2 font-medium">Service</th>
                      <th className="text-left p-2 font-medium w-28">Cost (₹)</th>
                      <th className="text-left p-2 font-medium w-20">Active</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="p-2">
                            <select
                              className="w-full rounded border bg-background px-2 py-1.5 text-sm"
                              value={row.segmentCategoryId}
                              onChange={(e) => updateRow(row.id, { segmentCategoryId: e.target.value })}
                            >
                              <option value="">Select…</option>
                              {segments.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              className="w-full rounded border bg-background px-2 py-1.5 text-sm"
                              value={row.serviceCategoryId}
                              onChange={(e) => updateRow(row.id, { serviceCategoryId: e.target.value })}
                            >
                              <option value="">Select…</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              className="h-8 w-24"
                              placeholder="0"
                              value={row.priceRupees === '' ? '' : row.priceRupees}
                              onChange={(e) => {
                                const v = e.target.value;
                                const n = v === '' ? '' : parseInt(v, 10);
                                updateRow(row.id, {
                                  priceRupees: n === '' ? '' : Number.isNaN(n) ? 0 : n,
                                });
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <Switch
                              checked={row.isActive}
                              onCheckedChange={(checked) => updateRow(row.id, { isActive: checked })}
                            />
                          </td>
                          <td className="p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeRow(row.id)}
                              title="Remove row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <p className="p-4 text-center text-muted-foreground text-sm">No price lines. Click “Add price line”.</p>
                )}
              </div>
              <Button type="button" size="lg" className="w-full" onClick={addPriceLine}>
                Add price line
              </Button>
            </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMatrix.isPending || hasDuplicates}>
              {updateMatrix.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
