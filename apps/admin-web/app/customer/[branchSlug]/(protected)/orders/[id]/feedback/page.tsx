'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { useCustomerFlowFeedbackEligibility } from '@/hooks/customer-flow/use-feedback-eligibility';
import { useSubmitCustomerFlowOrderFeedback } from '@/hooks/customer-flow/use-submit-order-feedback';
import { Button, buttonVariants } from '@/components/customer-flow/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/customer-flow/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/customer-flow/ui/card';
import { Skeleton } from '@/components/customer-flow/ui/skeleton';
import { fetchPortalPublic, getStoredPortal } from '@/lib/customer-flow/portal';

const formSchema = z.object({
  rating: z.coerce.number().min(1).max(5),
  message: z.string().optional(),
});

export default function CustomerFlowOrderFeedbackPage() {
  const params = useParams<{ branchSlug: string; id: string }>();
  const router = useRouter();
  const orderId = typeof params.id === 'string' ? params.id : null;
  const branchSlug = typeof params.branchSlug === 'string' ? params.branchSlug : '';
  const base = `/customer/${branchSlug}`;
  const { data: eligibility, isLoading: eligLoading } = useCustomerFlowFeedbackEligibility(orderId);
  const submitFeedback = useSubmitCustomerFlowOrderFeedback();
  const [primary, setPrimary] = useState(getStoredPortal()?.primaryColor ?? '#8a1459');
  const [secondary, setSecondary] = useState(getStoredPortal()?.secondaryColor ?? '#f4e8f0');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchSlug) return;
    void fetchPortalPublic(branchSlug).then((p) => {
      if (p?.primaryColor) setPrimary(p.primaryColor);
      if (p?.secondaryColor) setSecondary(p.secondaryColor);
    });
  }, [branchSlug]);
  const cardBg = useMemo(() => secondary, [primary, secondary]);
  const cardBorder = useMemo(() => `color-mix(in srgb, ${secondary} 78%, #d1d5db)`, [primary, secondary]);
  const textPrimary = useMemo(() => `color-mix(in srgb, ${primary} 80%, #111827)`, [primary]);
  const textMuted = useMemo(() => `color-mix(in srgb, ${primary} 45%, #4b5563)`, [primary]);

  if (eligLoading || !orderId) {
    return (
      <div className="min-h-screen p-4" style={{ backgroundColor: "#ffffff" }}>
        <Skeleton className="mx-auto h-48 max-w-md" style={{ backgroundColor: cardBg }} />
      </div>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <div className="min-h-screen p-4" style={{ backgroundColor: "#ffffff" }}>
        <Card className="mx-auto max-w-md" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <CardHeader>
            <CardTitle style={{ color: textPrimary }}>Feedback not available</CardTitle>
            <CardDescription style={{ color: textMuted }}>{eligibility?.reason ?? 'Feedback unavailable for this order.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`${base}/orders/${orderId}`} className={cn(buttonVariants({ variant: 'outline' }))}>
              Back to order
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    const parsed = formSchema.safeParse({ rating, message });
    if (!parsed.success) {
      setValidationError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }
    submitFeedback.mutate(
      { orderId: orderId!, rating: parsed.data.rating, message: parsed.data.message },
      { onSuccess: () => router.push(`${base}/orders/${orderId}`) },
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "#ffffff" }}>
      <header className="mb-6">
        <Link href={`${base}/orders/${orderId}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Order
        </Link>
      </header>
      <Card className="mx-auto max-w-md" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <CardHeader>
          <CardTitle style={{ color: textPrimary }}>Submit feedback</CardTitle>
          <CardDescription style={{ color: textMuted }}>Rate your experience for this order.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating (1–5)</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-[var(--customer-primary,#C2185B)] focus-visible:ring-2 focus-visible:ring-[var(--customer-primary,#C2185B)]"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium">Message (optional)</label>
              <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={submitFeedback.isPending}>
                {submitFeedback.isPending ? 'Submitting…' : 'Submit'}
              </Button>
              <Link href={`${base}/orders/${orderId}`} className={cn(buttonVariants({ variant: 'outline' }))}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


