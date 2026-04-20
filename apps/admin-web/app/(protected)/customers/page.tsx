'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { useCustomersList, useCustomersPhoneSearch } from '@/hooks/useCustomers';
import { getStoredUser, isBranchFilterLocked } from '@/lib/auth';
import { useBranches } from '@/hooks/useBranches';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CustomersTable } from '@/components/admin/customers/CustomersTable';
import { toast } from 'sonner';
import { Search, X } from 'lucide-react';
import type { AxiosError } from 'axios';

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const ax = err as AxiosError<{ error?: { message?: string } }>;
    const msg = ax.response?.data?.error?.message ?? ax.message;
    return msg || 'Request failed';
  }
  return err instanceof Error ? err.message : 'Request failed';
}

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const router = useRouter();
  const user = getStoredUser();
  const isBranchHead = user?.role === 'OPS';
  const isPartialAdmin = user?.role === 'PARTIAL_ADMIN';
  const branchLocked = !!(user && isBranchFilterLocked(user.role, user.branchId));
  const { data: branches = [] } = useBranches();
  const branchOptions = useMemo(() => {
    if (!isPartialAdmin) return branches;
    const allowed = new Set(user?.branchIds ?? []);
    return branches.filter((b) => allowed.has(b.id));
  }, [branches, isPartialAdmin, user?.branchIds]);

  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search.trim(), 400);
  const phoneDigits = useMemo(() => debouncedSearch.replace(/\D/g, ''), [debouncedSearch]);
  const effectiveBranchId = branchLocked ? (user?.branchId ?? '') : branchId;
  /** Full mobile (10+ digits): global phone search across all branches. Otherwise branch head sees branch-scoped list. */
  const useGlobalPhoneSearch = isBranchHead && phoneDigits.length >= 10;

  const listQuery = useCustomersList(PAGE_SIZE, cursor, debouncedSearch || null, effectiveBranchId || null, {
    enabled: !isBranchHead || !useGlobalPhoneSearch,
  });

  const phoneSearchQuery = useCustomersPhoneSearch(phoneDigits, { enabled: useGlobalPhoneSearch });

  const items = useGlobalPhoneSearch ? (phoneSearchQuery.data ?? []) : (listQuery.data?.data ?? []);
  const isLoading = useGlobalPhoneSearch ? phoneSearchQuery.isLoading : listQuery.isLoading;
  const error = useGlobalPhoneSearch ? phoneSearchQuery.error : listQuery.error;
  const nextCursor = useGlobalPhoneSearch ? null : (listQuery.data?.nextCursor ?? null);
  const hasNext = !!nextCursor;

  const handleRowClick = useCallback(
    (userId: string) => {
      router.push(`/customers/${userId}`);
    },
    [router],
  );

  const handleClear = useCallback(() => {
    setSearch('');
    setCursor(null);
  }, []);

  useEffect(() => {
    if (branchLocked) return;
    if (branchId) return;
    if (branchOptions.length === 1) {
      setBranchId(branchOptions[0].id);
      return;
    }
    const defaultBranch = branchOptions.find((b) => b.isDefault)?.id;
    if (defaultBranch) setBranchId(defaultBranch);
  }, [branchLocked, branchId, branchOptions]);

  useEffect(() => {
    if (error) toast.error(getErrorMessage(error));
  }, [error]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isBranchHead
            ? 'By default you see customers with at least one past or active order at your branch. Enter at least 10 digits of a mobile number to search all customers across every branch (same discovery as walk-in lookup). Use the box below to filter this list by name or partial phone.'
            : 'List of customers with order and subscription counts. Search by name or phone, or open a profile from the table.'}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!branchLocked && (
            <div className="mb-3 flex items-end gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Branch</label>
                <select
                  className="h-10 min-w-[180px]"
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setCursor(null);
                  }}
                  title="Filter customers by branch"
                >
                  {!isPartialAdmin && <option value="">All branches</option>}
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name ?? b.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type={isBranchHead ? 'tel' : 'search'}
                inputMode={isBranchHead ? 'numeric' : undefined}
                autoComplete={isBranchHead ? 'tel' : undefined}
                placeholder={
                  isBranchHead
                    ? 'Filter by name or partial phone — or enter full mobile (10+ digits) to search all branches'
                    : 'Search by name or phone (e.g. 9876543210 or +919876543210)'
                }
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCursor(null);
                }}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleClear} title="Clear">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isBranchHead && phoneDigits.length > 0 && phoneDigits.length < 10 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Enter more digits for global lookup across branches, or keep filtering this branch&apos;s customers.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <CustomersTable
            data={items}
            isLoading={isLoading}
            onRowClick={handleRowClick}
            hideSubscriptionColumns={isBranchHead}
            emptyDescription={
              isBranchHead
                ? useGlobalPhoneSearch
                  ? 'No customer matches that number across branches. Check the digits or confirm they are registered.'
                  : 'No customers with orders at this branch yet — or nothing matches your filter. Enter at least 10 digits of a mobile number to search all branches.'
                : undefined
            }
          />
          {!isBranchHead || !useGlobalPhoneSearch ? (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {items.length} customer{items.length === 1 ? '' : 's'} on this page
                {isBranchHead && !useGlobalPhoneSearch ? ' (this branch)' : ''}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!cursor} onClick={() => setCursor(null)}>
                  First page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext}
                  onClick={() => nextCursor && setCursor(nextCursor)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {`${items.length} match${items.length === 1 ? '' : 'es'} across all branches`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
