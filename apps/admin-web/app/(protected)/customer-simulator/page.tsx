'use client';

import Link from 'next/link';

export default function CustomerSimulatorPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Customer simulator</h1>
      <p className="text-sm text-muted-foreground">
        Subscription plans and subscription booking flows were removed from this product, so this simulator is no longer available.
      </p>
      <Link href="/dashboard" className="text-sm text-primary hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  );
}
