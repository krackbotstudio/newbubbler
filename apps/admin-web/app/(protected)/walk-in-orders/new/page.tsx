'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser, isBranchFilterLocked } from '@/lib/auth';
import { useBranches } from '@/hooks/useBranches';
import { useCustomer } from '@/hooks/useCustomers';
import {
  useWalkInLookupCustomer,
  useWalkInCreateCustomer,
  useWalkInCreateOrder,
} from '@/hooks/useWalkIn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFriendlyErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

export default function NewWalkInOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userIdFromProfile = searchParams.get('userId') ?? null;
  const user = useMemo(() => getStoredUser(), []);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PARTIAL_ADMIN';
  const branchLocked = !!(user && isBranchFilterLocked(user.role, user.branchId));
  const { data: branches = [] } = useBranches();
  const selectableBranches = useMemo(() => {
    if (!user) return branches;
    if (user.role !== 'PARTIAL_ADMIN') return branches;
    const allowed = new Set(user.branchIds ?? []);
    return branches.filter((b) => allowed.has(b.id));
  }, [branches, user]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [mobile, setMobile] = useState('');
  const combinedPhone = useMemo(
    () => (countryCode.trim().startsWith('+') ? countryCode.trim() : '+' + countryCode.trim()) + mobile.replace(/\D/g, '').slice(0, 10),
    [countryCode, mobile]
  );
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  const { data: preselectedCustomer, isLoading: preselectedLoading } = useCustomer(userIdFromProfile);

  const effectiveBranchId = useMemo(() => {
    if (branchLocked && user?.branchId) return user.branchId;
    if (selectedBranchId) return selectedBranchId;
    if (selectableBranches.length === 1) return selectableBranches[0].id;
    const defaultBranch = selectableBranches.find((b) => b.isDefault)?.id;
    return defaultBranch ?? '';
  }, [branchLocked, user?.branchId, selectedBranchId, selectableBranches]);

  useEffect(() => {
    if (branchLocked) return;
    if (selectedBranchId) return;
    if (selectableBranches.length === 1) {
      setSelectedBranchId(selectableBranches[0].id);
      return;
    }
    const defaultBranch = selectableBranches.find((b) => b.isDefault)?.id;
    if (defaultBranch) setSelectedBranchId(defaultBranch);
  }, [branchLocked, selectedBranchId, selectableBranches]);

  const { data: existingCustomer, isLoading: lookupLoading } = useWalkInLookupCustomer(submittedPhone);
  const createCustomer = useWalkInCreateCustomer();
  const createOrder = useWalkInCreateOrder();

  const customerResolved = !!preselectedCustomer || !!existingCustomer || customerId !== null;
  const effectiveCustomerId = preselectedCustomer?.id ?? existingCustomer?.id ?? customerId;
  const canCreateOrder =
    customerResolved &&
    effectiveCustomerId &&
    !!effectiveBranchId &&
    selectableBranches.some((b) => b.id === effectiveBranchId);

  const handleLookup = useCallback(() => {
    const digits = mobile.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Enter at least 10 digits for mobile');
      return;
    }
    setSubmittedPhone(combinedPhone);
  }, [mobile, combinedPhone]);

  const handleCreateCustomer = useCallback(async () => {
    const digits = mobile.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Mobile number is required (at least 10 digits)');
      return;
    }
    if (!name.trim()) {
      toast.error('Name is required for new customer');
      return;
    }
    try {
      const customer = await createCustomer.mutateAsync({
        phone: combinedPhone,
        name: name.trim(),
        email: email.trim() || undefined,
      });
      setCustomerId(customer.id);
      toast.success('Customer created');
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  }, [mobile, combinedPhone, name, email, createCustomer]);

  const handleCreateOrder = useCallback(async () => {
    const uid = effectiveCustomerId;
    if (!uid || !effectiveBranchId) {
      toast.error('Select customer');
      return;
    }
    try {
      const { id } = await createOrder.mutateAsync({ userId: uid, branchId: effectiveBranchId });
      toast.success('Order created');
      router.push(`/orders/${id}`);
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  }, [effectiveCustomerId, effectiveBranchId, createOrder, router]);

  const resetCustomer = useCallback(() => {
    setCustomerId(null);
    setSubmittedPhone('');
    setName('');
    setEmail('');
  }, []);

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/walk-in-orders">← Walk-in orders</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">New walk-in order</h1>

      {isAdmin && !branchLocked && (
        <Card>
          <CardHeader>
            <CardTitle>Branch</CardTitle>
            <CardDescription>Select the branch where this walk-in order is created.</CardDescription>
          </CardHeader>
          <CardContent>
            <select
              className="h-10 min-w-[220px]"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              title="Select branch"
            >
              <option value="">Select branch</option>
              {selectableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
          <CardDescription>
            {preselectedCustomer
              ? 'Customer selected from profile. Create order.'
              : 'Enter customer mobile. If they exist, name and email will be loaded. Otherwise enter name and optional email to create the customer.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userIdFromProfile && preselectedLoading && (
            <p className="text-sm text-muted-foreground">Loading customer from profile…</p>
          )}

          {preselectedCustomer && (
            <div className="rounded-md border bg-muted/50 p-3 space-y-1">
              <p className="font-medium">Customer (from profile)</p>
              <p className="text-sm">Name: {preselectedCustomer.name ?? '—'}</p>
              <p className="text-sm">Email: {preselectedCustomer.email ?? '—'}</p>
              <p className="text-sm">Phone: {preselectedCustomer.phone ?? '—'}</p>
            </div>
          )}

          {(!userIdFromProfile || (!preselectedLoading && !preselectedCustomer)) && (
            <>
          <div className="flex gap-2 flex-wrap items-end">
            <div className="space-y-2">
              <label htmlFor="countryCode" className="text-sm font-medium">
                Country code
              </label>
              <Input
                id="countryCode"
                type="tel"
                placeholder="+91"
                value={countryCode}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 3);
                  setCountryCode(d ? '+' + d : '+91');
                }}
                className="w-24"
              />
            </div>
            <div className="flex-1 min-w-[140px] space-y-2">
              <label htmlFor="mobile" className="text-sm font-medium">
                Mobile number
              </label>
              <Input
                id="mobile"
                type="tel"
                placeholder="9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
              />
            </div>
            <div className="pt-8">
              <Button
                onClick={handleLookup}
                disabled={mobile.replace(/\D/g, '').length < 10}
              >
                Look up
              </Button>
            </div>
          </div>

          {lookupLoading && <p className="text-sm text-muted-foreground">Looking up customer…</p>}

          {submittedPhone && existingCustomer && !customerId && (
            <div className="rounded-md border bg-muted/50 p-3 space-y-1">
              <p className="font-medium">Existing customer</p>
              <p className="text-sm">Name: {existingCustomer.name ?? '—'}</p>
              <p className="text-sm">Email: {existingCustomer.email ?? '—'}</p>
              <p className="text-sm">Phone: {existingCustomer.phone ?? combinedPhone}</p>
              <Button variant="outline" size="sm" onClick={resetCustomer}>
                Use different number
              </Button>
            </div>
          )}

          {submittedPhone && !existingCustomer && !customerId && !lookupLoading && (
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm text-muted-foreground">Customer not found. Create one:</p>
              <div className="space-y-2">
                <div>
                  <label htmlFor="name" className="text-sm font-medium">
                    Name (required)
                  </label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="text-sm font-medium">
                    Email (optional)
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <Button
                  onClick={handleCreateCustomer}
                  disabled={!name.trim() || createCustomer.isPending}
                >
                  {createCustomer.isPending ? 'Creating…' : 'Create customer'}
                </Button>
              </div>
            </div>
          )}

          {customerId && (
            <div className="rounded-md border bg-muted/50 p-3">
              <p className="font-medium">Customer created</p>
              <p className="text-sm">Name: {name || '—'}, Phone: {combinedPhone || '—'}</p>
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          onClick={handleCreateOrder}
          disabled={!canCreateOrder || createOrder.isPending}
        >
          {createOrder.isPending ? 'Creating order…' : 'Create order'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/walk-in-orders">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
