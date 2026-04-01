'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getApiError, getApiOrigin, getBaseURL } from '@/lib/api';
import { setToken, setStoredUser, type AuthUser } from '@/lib/auth';
import { usePublicBranding } from '@/hooks/useBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      const { data } = await api.post<{ token: string; user: AuthUser }>(
        '/auth/admin/login',
        parsed.data,
        { timeout: 15000 }
      );
      setToken(data.token);
      setStoredUser(data.user);
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-4">
          {logoUrl && (
            <div className="flex justify-center">
              <img
                src={logoUrl}
                alt={publicBranding?.businessName ?? 'Logo'}
                className="h-16 w-auto max-h-20 object-contain"
              />
            </div>
          )}
          <CardTitle>Admin login</CardTitle>
          <CardDescription>Sign in with your admin or billing account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <>
                <ErrorDisplay error={error} />
                <p className="text-xs text-muted-foreground mt-2">
                  Using API: <code className="rounded bg-muted px-1 font-mono">{getBaseURL()}</code>
                </p>
              </>
            ) : null}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@laundry.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
