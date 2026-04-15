'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { useCustomersList, useCustomersPhoneSearch } from '@/hooks/useCustomers';
import { getStoredUser } from '@/lib/auth';
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

  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search.trim(), 400);
  const phoneDigits = useMemo(() => debouncedSearch.replace(/\D/g, ''), [debouncedSearch]);

  const listQuery = useCustomersList(PAGE_SIZE, cursor, debouncedSearch || null, {
    enabled: !isBranchHead,
  });

  const phoneSearchQuery = useCustomersPhoneSearch(phoneDigits, { enabled: isBranchHead });

  const items = isBranchHead ? (phoneSearchQuery.data ?? []) : (listQuery.data?.data ?? []);
  const isLoading = isBranchHead ? phoneSearchQuery.isLoading : listQuery.isLoading;
  const error = isBranchHead ? phoneSearchQuery.error : listQuery.error;
  const nextCursor = isBranchHead ? null : (listQuery.data?.nextCursor ?? null);
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
    if (error) toast.error(getErrorMessage(error));
  }, [error]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isBranchHead
            ? 'Search by customer phone number (at least 10 digits). Uses the same matching as walk-in lookup — customers appear even if they have not placed an order yet.'
            : 'List of customers with order and subscription counts. Search by name or phone, or open a profile from the table.'}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type={isBranchHead ? 'tel' : 'search'}
                inputMode={isBranchHead ? 'numeric' : undefined}
                autoComplete={isBranchHead ? 'tel' : undefined}
                placeholder={
                  isBranchHead
                    ? 'Phone number (e.g. 9876543210 or +91 98765 43210) — at least 10 digits'
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
            <p className="mt-2 text-xs text-muted-foreground">Enter at least 10 digits to search.</p>
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
                ? 'Enter at least 10 digits of the customer phone number. If nobody appears, check the number or confirm they are registered as a customer.'
                : undefined
            }
          />
          {!isBranchHead ? (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {items.length} customer{items.length === 1 ? '' : 's'} on this page
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
              {phoneDigits.length >= 10
                ? `${items.length} match${items.length === 1 ? '' : 'es'}`
                : 'No search yet.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
