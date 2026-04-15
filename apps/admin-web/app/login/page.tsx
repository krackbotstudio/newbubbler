'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getApiError, getApiOrigin, getBaseURL } from '@/lib/api';
import { setToken, setStoredUser, type AuthUser } from '@/lib/auth';
import { usePublicBranding } from '@/hooks/useBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { data: publicBranding } = usePublicBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const logoUrl = publicBranding?.logoUrl
    ? publicBranding.logoUrl.startsWith('http')
      ? publicBranding.logoUrl
      : `${getApiOrigin()}${publicBranding.logoUrl}`
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(new Error(parsed.error.errors[0]?.message ?? 'Invalid input'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{
        token: string;
        user: AuthUser & { onboardingCompletedAt?: string | null };
      }>('/auth/admin/login', parsed.data, { timeout: 15000 });
      setToken(data.token);
      setStoredUser({
        ...data.user,
        onboardingCompletedAt: data.user.onboardingCompletedAt ?? null,
      });
      const needOnboarding =
        data.user.role === 'OPS' &&
        (data.user.onboardingCompletedAt == null || data.user.onboardingCompletedAt === '');
      router.replace(needOnboarding ? '/onboarding' : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-slate-100 lg:h-auto lg:min-h-screen lg:w-1/2">
        <Image
          src="/images/login-hero.png"
          alt="Laundry professional beside a washing machine, welcoming you to sign in"
          fill
          className="object-cover object-[center_20%] lg:object-[center_center]"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8 space-y-6">
            {logoUrl ? (
              <div className="flex justify-start">
                <img
                  src={logoUrl}
                  alt={publicBranding?.businessName ?? 'Logo'}
                  className="h-14 w-auto max-h-16 object-contain"
                />
              </div>
            ) : (
              <p className="text-2xl font-bold tracking-tight text-slate-900">Bubbler</p>
            )}
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Admin login</h1>
              <p className="mt-1.5 text-sm text-slate-500">Sign in with your admin or billing account.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <>
                <ErrorDisplay error={error} />
                <p className="text-xs text-slate-500">
                  Using API: <code className="rounded bg-slate-100 px-1 font-mono text-slate-700">{getBaseURL()}</code>
                </p>
              </>
            ) : null}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@laundry.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-lg bg-slate-800 text-base font-medium text-white hover:bg-slate-900"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            New branch?{' '}
            <Link href="/signup" className="font-medium text-slate-900 underline-offset-4 hover:underline">
              Create account
            </Link>
          </p>

          <p className="mt-10 text-center text-xs text-slate-400">
            Designed and developed by{' '}
            <span className="font-medium text-slate-500">Krackbot Studio</span>
          </p>
        </div>
      </div>
    </div>
  );
}
