'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { getStoredUser, isBranchScopedStaff } from '@/lib/auth';
import { RoleGate } from '@/components/shared/RoleGate';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalogItemsWithMatrix } from '@/hooks/useCatalog';
import { useBranches } from '@/hooks/useBranches';
import { AddItemModal } from '@/components/catalog/AddItemModal';
import { EditItemModal } from '@/components/catalog/EditItemModal';
import { ManageServicesSegmentsModal } from '@/components/catalog/ManageServicesSegmentsModal';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { toast } from 'sonner';
import type { CatalogItemWithMatrix } from '@/types';
import { Download, Search, Settings2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function CatalogPage() {
  const user = getStoredUser();
  const role = user?.role ?? 'CUSTOMER';
  const isBranchHead = isBranchScopedStaff(role) && !!user?.branchId;

  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItemWithMatrix | null>(null);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() =>
    isBranchHead && user?.branchId ? [user.branchId] : [],
  );
  const [itemSearch, setItemSearch] = useState('');

  const { data, isLoading, error } = useCatalogItemsWithMatrix();
  const { data: branches = [] } = useBranches();
  const selectedBranchId = selectedBranchIds[0] ?? '';

  useEffect(() => {
    if (isBranchHead && user?.branchId) {
      if (selectedBranchIds.length !== 1 || selectedBranchIds[0] !== user.branchId) {
        setSelectedBranchIds([user.branchId]);
      }
      return;
    }
    if (selectedBranchIds.length > 1) {
      setSelectedBranchIds([selectedBranchIds[0]]);
    }
  }, [isBranchHead, user?.branchId, selectedBranchIds]);

  const allItems = data?.items ?? [];
  const branchFilteredItems = useMemo(() => {
    if (selectedBranchIds.length === 0) return allItems;
    return allItems.filter((item) => {
      const ids = item.branchIds ?? [];
      if (ids.length === 0) return true;
      return ids.some((id) => selectedBranchIds.includes(id));
    });
  }, [allItems, selectedBranchIds]);
  const serviceCategories = data?.serviceCategories ?? [];
  const segmentCategories = data?.segmentCategories ?? [];

  const searchNorm = itemSearch.trim().toLowerCase();
  const displayItems = useMemo(() => {
    if (!searchNorm) return branchFilteredItems;
    const segLabels = new Map(segmentCategories.map((s) => [s.id, (s.label || s.code || '').toLowerCase()]));
    const svcLabels = new Map(serviceCategories.map((s) => [s.id, (s.label || s.code || '').toLowerCase()]));
    return branchFilteredItems.filter((item) => {
      if (item.name.toLowerCase().includes(searchNorm)) return true;
      if (item.id.toLowerCase().includes(searchNorm)) return true;
      for (const line of item.segmentPrices) {
        const seg = segLabels.get(line.segmentCategoryId) ?? '';
        const svc = svcLabels.get(line.serviceCategoryId) ?? '';
        if (seg.includes(searchNorm) || svc.includes(searchNorm)) return true;
      }
      return false;
    });
  }, [branchFilteredItems, searchNorm, segmentCategories, serviceCategories]);

  const handleEditClick = useCallback((item: CatalogItemWithMatrix) => {
    setEditItem(item);
    setEditItemOpen(true);
  }, []);

  const handleDownloadCatalog = useCallback(() => {
    const segmentMap = new Map(segmentCategories.map((s) => [s.id, s.label]));
    const serviceMap = new Map(serviceCategories.map((s) => [s.id, s.label]));
    const rows = branchFilteredItems.flatMap((item) => {
      if (item.segmentPrices.length === 0) {
        return [{
          'Item name': item.name,
          Segment: '',
          Service: '',
          Cost: 0,
          'Active / Inactive': item.active ? 'Active' : 'Inactive',
        }];
      }
      return item.segmentPrices.map((line) => ({
        'Item name': item.name,
        Segment: segmentMap.get(line.segmentCategoryId) ?? line.segmentCategoryId,
        Service: serviceMap.get(line.serviceCategoryId) ?? line.serviceCategoryId,
        Cost: line.priceRupees,
        'Active / Inactive': line.isActive ? 'Active' : 'Inactive',
      }));
    });
    if (rows.length === 0) {
      toast.error('No catalog data to download.');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catalog');
    XLSX.writeFile(workbook, `catalog-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [branchFilteredItems, segmentCategories, serviceCategories]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <p className="text-sm text-destructive">Failed to load catalog.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
            <p className="text-sm text-muted-foreground">
              {searchNorm
                ? `${displayItems.length} match${displayItems.length === 1 ? '' : 'es'} of ${branchFilteredItems.length} item${branchFilteredItems.length === 1 ? '' : 's'}`
                : `${displayItems.length} item${displayItems.length === 1 ? '' : 's'} shown`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isBranchHead ? (
              <select
                className="h-10 min-h-[2.5rem] min-w-[140px] disabled:opacity-70"
                value={selectedBranchId}
                disabled
                title="Your assigned branch (cannot change)"
              >
                <option value={user?.branchId ?? ''}>
                  {branches.find((b) => b.id === user?.branchId)?.name ?? user?.branchId ?? '—'}
                </option>
              </select>
            ) : (
              <select
                className="h-10 min-h-[2.5rem] min-w-[140px]"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchIds(e.target.value ? [e.target.value] : [])}
                title="Filter catalog by branch name"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name ?? b.id}
                  </option>
                ))}
              </select>
            )}
            <RoleGate role={role} gate="catalogEdit">
              <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                Manage Services &amp; Segments
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCatalog}>
                <Download className="mr-2 h-4 w-4" />
                Download catalog
              </Button>
              <Button onClick={() => setAddOpen(true)}>Add item</Button>
            </RoleGate>
          </div>
        </div>
        <div className="relative mt-4 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            placeholder="Search items by name, segment, or service…"
            className="pl-9"
            aria-label="Search catalog items"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayItems.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              serviceCategories={serviceCategories}
              segmentCategories={segmentCategories}
              canEdit={role === 'ADMIN'}
              onEdit={() => handleEditClick(item)}
            />
          ))}
          {branchFilteredItems.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground">No items yet.</p>
          )}
          {branchFilteredItems.length > 0 && displayItems.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground">No items match your search.</p>
          )}
        </div>
      )}

      <AddItemModal open={addOpen} onOpenChange={setAddOpen} />
      <ManageServicesSegmentsModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        segmentCategories={segmentCategories}
        serviceCategories={serviceCategories}
      />
      <EditItemModal
        item={editItem}
        serviceCategories={serviceCategories}
        segmentCategories={segmentCategories}
        open={editItemOpen}
        onOpenChange={setEditItemOpen}
      />
    </div>
  );
}
