'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OrderDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Order detail error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-6">
      <h2 className="text-lg font-semibold">Something went wrong loading this order</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {error.message || 'A client-side error occurred. Check the browser console for details.'}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/orders">← Back to Orders</Link>
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
