'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { OpsBranchBrandingView } from '@/components/branding/OpsBranchBrandingView';
import { getStoredUser } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function AdminBranchBrandingPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.branchId as string;
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user?.role === 'ADMIN' || user?.role === 'BILLING') {
      setIsAuthorized(true);
    } else {
      // If ops or agent tries to access a different branch, they shouldn't be here
      // But middleware/routes guards usually handle this.
      router.push('/branding');
    }
  }, [router]);

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/branding')}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Global Branding
        </Button>
      </div>

      <OpsBranchBrandingView branchId={branchId} />
    </div>
  );
}
