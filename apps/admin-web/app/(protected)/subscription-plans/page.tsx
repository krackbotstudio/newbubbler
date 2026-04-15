'use client';

import { useState, useMemo } from 'react';
import { getStoredUser, isBranchScopedStaff } from '@/lib/auth';
import { BranchFilter } from '@/components/shared/BranchFilter';
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
import { useSubscriptionPlans, useUpdatePlan } from '@/hooks/useSubscriptionPlans';
import { useBranches } from '@/hooks/useBranches';
import { PlanFormModal } from '@/components/subscriptions/PlanFormModal';
import { formatMoney } from '@/lib/format';
import { toast } from 'sonner';
import type { SubscriptionPlan } from '@/types';
import { Pencil } from 'lucide-react';

const VARIANT_LABELS: Record<string, string> = {
  SINGLE: 'Single',
  COUPLE: 'Couple',
  FAMILY: 'Family',
};

const COLUMNS_WITH_ACTIONS = 10;
const COLUMNS_READONLY = 9;

export default function SubscriptionPlansPage() {
  const user = getStoredUser();
  const role = user?.role ?? 'CUSTOMER';
  const isBranchHead = isBranchScopedStaff(role) && !!user?.branchId;
  const canEdit = role === 'ADMIN';
  const columnCount = canEdit ? COLUMNS_WITH_ACTIONS : COLUMNS_READONLY;

  const [addOpen, setAddOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() =>
    isBranchHead && user?.branchId ? [user.branchId] : [],
  );

  const { data: plansRaw, isLoading, error } = useSubscriptionPlans();
  const { data: branchesList = [] } = useBranches();
  const branchesMap = useMemo(() => new Map(branchesList.map((b) => [b.id, b.name])), [branchesList]);
  const plans = useMemo(() => {
    if (!plansRaw) return undefined;
    if (selectedBranchIds.length === 0) return plansRaw;
    return plansRaw.filter((p) => {
      if (p.branchIds.length === 0) return true;
      return p.branchIds.some((bid) => selectedBranchIds.includes(bid));
    });
  }, [plansRaw, selectedBranchIds]);

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditPlan(plan);
    setEditOpen(true);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Subscription plans</h1>
        <p className="text-sm text-destructive">Failed to load subscription plans.</p>
        <ErrorDisplay error={error} className="mt-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Subscription plans</h1>
        <div className="flex flex-wrap items-center gap-2">
          <BranchFilter
            selectedBranchIds={selectedBranchIds}
            onChange={setSelectedBranchIds}
            compactLabel
            disabled={!!isBranchHead}
          />
          {role === 'ADMIN' ? (
            <Button onClick={() => setAddOpen(true)}>Add plan</Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Max pickups</TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Active</TableHead>
                  {role === 'ADMIN' ? <TableHead className="w-[80px]"></TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(plans ?? []).map((plan) => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    canEdit={canEdit}
                    onEdit={() => handleEdit(plan)}
                    branchIds={plan.branchIds ?? []}
                    branchesMap={branchesMap}
                  />
                ))}
                {(!plans || plans.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="text-center text-muted-foreground">
                      No plans yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PlanFormModal plan={null} open={addOpen} onOpenChange={setAddOpen} mode="add" />
      <PlanFormModal plan={editPlan} open={editOpen} onOpenChange={setEditOpen} mode="edit" />
    </div>
  );
}

function PlanRow({
  plan,
  canEdit,
  onEdit,
  branchIds,
  branchesMap,
}: {
  plan: SubscriptionPlan;
  canEdit: boolean;
  onEdit: () => void;
  branchIds: string[];
  branchesMap: Map<string, string>;
}) {
  const updatePlan = useUpdatePlan(plan.id);
  const branchNames = branchIds.map((id) => branchesMap.get(id) ?? id);
  const branchDisplay =
    branchIds.length === 0
      ? 'All branches'
      : branchIds.length === 1
        ? branchNames[0]
        : `${branchIds.length} branches`;
  const branchTooltip =
    branchIds.length === 0 ? 'Applies to all branches' : branchIds.length <= 2 ? branchNames.join(', ') : branchNames.join(', ');

  const handleToggleActive = (checked: boolean) => {
    if (!canEdit) return;
    updatePlan.mutate(
      { active: checked },
      {
        onSuccess: () => toast.success(checked ? 'Plan enabled' : 'Plan disabled'),
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span>{plan.name}</span>
        {plan.redemptionMode === 'SINGLE_USE' && (
          <span className="ml-2 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            Single-use
          </span>
        )}
      </TableCell>
      <TableCell>{VARIANT_LABELS[plan.variant] ?? plan.variant}</TableCell>
      <TableCell title={branchTooltip}>{branchDisplay}</TableCell>
      <TableCell>{plan.validityDays} days</TableCell>
      <TableCell>{plan.maxPickups}</TableCell>
      <TableCell>
        {plan.kgLimit != null && plan.kgLimit > 0
          ? `${plan.kgLimit} kg`
          : plan.itemsLimit != null && plan.itemsLimit > 0
            ? `${plan.itemsLimit} items`
            : '—'}
      </TableCell>
      <TableCell>{formatMoney(plan.pricePaise)}</TableCell>
      <TableCell>
        {canEdit ? (
          <Switch
            checked={plan.active}
            onCheckedChange={handleToggleActive}
            disabled={updatePlan.isPending}
          />
        ) : (
          plan.active ? 'Yes' : 'No'
        )}
      </TableCell>
      {canEdit && (
        <TableCell>
          <Button variant="ghost" size="sm" onClick={onEdit} title="Edit plan">
            <Pencil className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
