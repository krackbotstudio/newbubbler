'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getApiError } from '@/lib/api';
import { setToken, setStoredUser, type CustomerUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { z } from 'zod';

const phoneSchema = z.string().regex(/^\+91[6-9]\d{9}$/, 'Use +91 followed by 10 digits');
const otpSchema = z.string().length(6, 'OTP is 6 digits');

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid phone');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{ requestId: string }>('/auth/customer/otp/request', {
        phone: parsed.data,
      });
      setRequestId(data.requestId);
      setOtp('');
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const phoneParsed = phoneSchema.safeParse(phone);
    const otpParsed = otpSchema.safeParse(otp);
    if (!phoneParsed.success) {
      setError(phoneParsed.error.errors[0]?.message ?? 'Invalid phone');
      return;
    }
    if (!otpParsed.success) {
      setError(otpParsed.error.errors[0]?.message ?? 'Invalid OTP');
      return;
    }
    if (!requestId) {
      setError('Request OTP first');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: CustomerUser }>(
        '/auth/customer/otp/verify',
        {
          phone: phoneParsed.data,
          otp: otpParsed.data,
          requestId,
        }
      );
      setToken(data.token);
      setStoredUser(data.user);
      router.replace('/orders');
      router.refresh();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] min-h-screen w-full items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Customer login</CardTitle>
          <CardDescription>Enter phone and verify OTP (dev OTP: 123456)</CardDescription>
        </CardHeader>
        <CardContent>
          {!requestId ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone
                </label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+919999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Request OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Sending OTP to {phone}</p>
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium">
                  OTP
                </label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => setRequestId(null)}
                >
                  Change number
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Verifying…' : 'Verify OTP'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
