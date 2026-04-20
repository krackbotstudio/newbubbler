'use client';

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { queryClient } from '@/lib/query-client';

function normalizeToastMessage(input: unknown): string | number | null | undefined {
  if (input == null) return input as null | undefined;
  if (typeof input === 'string' || typeof input === 'number') return input;
  if (input instanceof Error) return input.message || 'Unexpected error';
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    try {
      return JSON.stringify(input);
    } catch {
      return 'Unexpected error';
    }
  }
  return String(input);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const t = toast as unknown as Record<string, unknown>;
    if ((t.__safeWrapped as boolean | undefined) === true) return;
    const methods = ['message', 'error', 'success', 'info', 'warning', 'loading'] as const;
    for (const m of methods) {
      const fn = t[m];
      if (typeof fn !== 'function') continue;
      const original = fn as (...args: unknown[]) => unknown;
      t[m] = ((message: unknown, ...rest: unknown[]) => original(normalizeToastMessage(message), ...rest)) as unknown;
    }
    t.__safeWrapped = true;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" closeButton />
    </QueryClientProvider>
  );
}
