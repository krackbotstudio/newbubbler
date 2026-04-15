'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStoredUser, isBranchScopedStaff } from '@/lib/auth';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useServiceAreas, usePatchServiceArea, useDeleteServiceArea } from '@/hooks/useServiceAreas';
import { useBranches } from '@/hooks/useBranches';
import { AddPincodeModal } from '@/components/service-areas/AddPincodeModal';
import { EditPincodeModal } from '@/components/service-areas/EditPincodeModal';
import { toast } from 'sonner';
import { getApiError } from '@/lib/api';
import type { ServiceArea } from '@/types';
import { Pencil, Trash2 } from 'lucide-react';

export default function ServiceAreasPage() {
  const user = getStoredUser();
  const role = user?.role ?? 'CUSTOMER';
  const isBranchHead = isBranchScopedStaff(role) && !!user?.branchId;
  /** Branch heads (OPS) manage pincodes for their branch only; admins manage all. */
  const canManageServiceAreas = role === 'ADMIN' || (role === 'OPS' && !!user?.branchId);

  const [addOpen, setAddOpen] = useState(false);
  const [editArea, setEditArea] = useState<ServiceArea | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>(() =>
    isBranchHead && user?.branchId ? user.branchId : '',
  );

  useEffect(() => {
    if (isBranchHead && user?.branchId) {
      setBranchFilter(user.branchId);
    }
  }, [isBranchHead, user?.branchId]);

  const { data: branches = [], isLoading: branchesLoading } = useBranches();
  const branchIdForApi = branchFilter || undefined;
  const { data: areas, isLoading, error } = useServiceAreas(branchIdForApi);
  const branchNameById = Object.fromEntries(branches.map((b) => [b.id, b.name ?? b.id]));

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Service Areas</h1>
        <p className="text-sm text-destructive">Failed to load service areas.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Service Areas</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="branch-filter" className="text-sm text-muted-foreground">Branch</label>
          <select
            id="branch-filter"
            className="flex h-9 min-w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={!!isBranchHead}
            title={isBranchHead ? 'Your assigned branch (filter locked)' : undefined}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {canManageServiceAreas ? (
            <Button onClick={() => setAddOpen(true)}>Add Pincode</Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pincodes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead>Active</TableHead>
                  {canManageServiceAreas && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(areas ?? []).map((area) => (
                  <ServiceAreaRow
                    key={area.id}
                    area={area}
                    branchName={branchesLoading ? '…' : (branchNameById[area.branchId] ?? `Branch (${area.branchId})`)}
                    canEdit={
                      canManageServiceAreas &&
                      (role === 'ADMIN' || (role === 'OPS' && user?.branchId === area.branchId))
                    }
                    queryKey={['admin', 'service-areas', branchIdForApi ?? 'all']}
                    onEdit={() => { setEditArea(area); setEditOpen(true); }}
                  />
                ))}
                {(!areas || areas.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={canManageServiceAreas ? 4 : 3} className="text-center text-muted-foreground">
                      No pincodes yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddPincodeModal
        open={addOpen}
        onOpenChange={setAddOpen}
        lockedBranchId={role === 'OPS' && user?.branchId ? user.branchId : null}
      />
      <EditPincodeModal
        area={editArea}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditArea(null);
        }}
        lockedBranchId={role === 'OPS' && user?.branchId ? user.branchId : null}
      />
    </div>
  );
}

function ServiceAreaRow({
  area,
  branchName,
  canEdit,
  queryKey,
  onEdit,
}: {
  area: ServiceArea;
  branchName: string;
  canEdit: boolean;
  queryKey: (string | undefined)[];
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const patchArea = usePatchServiceArea(area.id);
  const deleteArea = useDeleteServiceArea();

  const handleToggle = (checked: boolean) => {
    if (!canEdit) return;
    const previous = queryClient.getQueryData<ServiceArea[]>(queryKey);
    queryClient.setQueryData<ServiceArea[]>(queryKey, (old) =>
      (old ?? []).map((a) => (a.id === area.id ? { ...a, active: checked } : a))
    );
    patchArea.mutate(
      { active: checked },
      {
        onSuccess: () => {
          toast.success(checked ? 'Pincode enabled' : 'Pincode disabled');
        },
        onError: (err) => {
          if (previous != null) {
            queryClient.setQueryData(queryKey, previous);
          }
          toast.error(getApiError(err).message);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!canEdit) return;
    if (!confirm(`Remove pincode ${area.pincode} from service areas?`)) return;
    deleteArea.mutate(area.id, {
      onSuccess: () => toast.success('Pincode removed'),
      onError: (err) => toast.error(getApiError(err).message),
    });
  };

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{branchName}</TableCell>
      <TableCell className="font-medium">{area.pincode}</TableCell>
      <TableCell>
        {canEdit ? (
          <Switch
            checked={area.active}
            onCheckedChange={handleToggle}
            disabled={patchArea.isPending}
          />
        ) : (
          <span className="text-muted-foreground">{area.active ? 'Yes' : 'No'}</span>
        )}
      </TableCell>
      {canEdit && (
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleteArea.isPending}
              title="Delete"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
