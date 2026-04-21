'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStoredUser } from '@/lib/auth';
import { useCustomer } from '@/hooks/useCustomers';
import { CustomerHeader } from '@/components/admin/customers/CustomerHeader';
import { CustomerProfileCard } from '@/components/admin/customers/CustomerProfileCard';
import { CustomerAddressesCard } from '@/components/admin/customers/CustomerAddressesCard';
import { CustomerOrdersTable } from '@/components/admin/customers/CustomerOrdersTable';
import { CustomerPaymentsTable } from '@/components/admin/customers/CustomerPaymentsTable';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = typeof params.id === 'string' ? params.id : '';
  const user = getStoredUser();
  const role = user?.role ?? 'CUSTOMER';

  const [profileEditOpen, setProfileEditOpen] = useState(false);

  const { data: customer, isLoading, error } = useCustomer(userId);

  const handleBack = useCallback(() => {
    router.push('/customers');
  }, [router]);

  if (!userId) {
    return (
      <div className="space-y-6">
        <EmptyState title="Invalid customer" action={<Button onClick={handleBack}>Back to customers</Button>} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
        </div>
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <EmptyState
          title="Customer not found"
          description="The customer may have been removed or the link is invalid."
          action={<Button onClick={handleBack}>Back to customers</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CustomerHeader
        customer={customer}
        onBack={handleBack}
        onEditClick={() => setProfileEditOpen(true)}
        role={role}
      />

      <div className="max-w-2xl">
        <CustomerProfileCard
          customer={customer}
          role={role}
          modalOpen={profileEditOpen}
          onModalOpenChange={setProfileEditOpen}
        />
      </div>

      <CustomerAddressesCard customer={customer} />

      <CustomerOrdersTable
        userId={customer.id}
        role={role}
        userBranchId={user?.branchId ?? null}
      />

      <CustomerPaymentsTable
        userId={customer.id}
        role={role}
        userBranchId={user?.branchId ?? null}
      />
    </div>
  );
}
