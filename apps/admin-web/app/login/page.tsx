'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getApiError, getBaseURL } from '@/lib/api';
import { setToken, setStoredUser, type AuthUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

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
      const apiErr = getApiError(err);
      if (apiErr.status === 401) {
        setError(new Error('Wrong email or password.'));
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-white lg:h-screen lg:flex-row lg:overflow-hidden"
      style={
        {
          '--primary': '222 58% 39%',
          '--ring': '222 58% 39%',
        } as CSSProperties
      }
    >
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-gradient-to-br from-[#1D4ED8] via-[#1E40AF] to-[#172554] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-1/2 lg:items-center lg:justify-center">
        <div className="flex h-full items-center justify-center px-6">
          <Image
            src="/images/login-logo-dark.png"
            alt="Bubbler logo"
            width={440}
            height={160}
            className="h-auto w-full max-w-[280px] object-contain lg:max-w-[430px]"
            priority
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:h-screen lg:w-1/2 lg:overflow-y-auto lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8 space-y-6">
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
                className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
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
                className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
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
            <Link href="/signup" className="font-semibold text-blue-700 underline-offset-4 hover:text-blue-800 hover:underline">
              Create account
            </Link>
          </p>

          <div className="mt-10 border-t border-slate-100 pt-4 text-center text-sm text-slate-400">
            <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap leading-none">
              <span className="leading-none">Designed and developed by</span>
            <a
              href="https://www.krackbot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold leading-none text-slate-500 transition-colors hover:text-slate-700"
            >
              <Image
                src="/images/krackbot-mark.png"
                alt="Krackbot logo"
                width={22}
                height={22}
                className="h-[20px] w-[20px] object-contain"
              />
              <span className="leading-none">Krackbot Studio</span>
            </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
