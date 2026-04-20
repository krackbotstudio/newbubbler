'use client';

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { api } from '@/lib/api';
import { setToken, setStoredUser, type AuthUser } from '@/lib/auth';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase-browser';
import { usePublicBranding } from '@/hooks/useBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { getApiOrigin } from '@/lib/api';

/** Supabase email OTP length can be 6 or 8 (and may change with project settings). */
const EMAIL_OTP_MIN_LEN = 6;
const EMAIL_OTP_MAX_LEN = 8;

const emailSchema = z.object({
  email: z.string().email('Invalid email'),
});

const otpSchema = z.object({
  code: z
    .string()
    .regex(
      new RegExp(`^\\d{${EMAIL_OTP_MIN_LEN},${EMAIL_OTP_MAX_LEN}}$`),
      `Enter the code from your email (${EMAIL_OTP_MIN_LEN}–${EMAIL_OTP_MAX_LEN} digits, numbers only)`,
    ),
});

const accountSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().max(200).optional(),
    branchName: z.string().min(1, 'Branch name is required'),
    branchAddress: z.string().min(1, 'Branch address is required'),
    branchPhone: z
      .string()
      .trim()
      .min(1, 'Branch phone is required')
      .max(50)
      .refine(
        (s) => {
          const digits = s.replace(/\D/g, '');
          return digits.length >= 10 && digits.length <= 15;
        },
        'Enter a valid phone number (10–15 digits, spaces or + allowed)',
      ),
    branchContactEmail: z.string().max(254).optional(),
    gstNumber: z.string().max(32).optional(),
    panNumber: z.string().max(20).optional(),
    footerNote: z.string().max(500).optional(),
    upiId: z.string().max(120).optional(),
    upiPayeeName: z.string().max(120).optional(),
    upiLink: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const be = data.branchContactEmail?.trim();
    if (be && !z.string().email().safeParse(be).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid public branch email',
        path: ['branchContactEmail'],
      });
    }
  });

type Step = 'email' | 'otp' | 'account';

const RESEND_COOLDOWN_SEC = 60;
/** After Supabase email rate limit, wait longer before allowing another send from this browser. */
const RATE_LIMIT_COOLDOWN_SEC = 90;

/** Sample OTP for local dev when `NEXT_PUBLIC_DEV_SIGNUP_OTP` is set (any truthy value). */
const DEV_SIGNUP_OTP_SAMPLE = '123456';

function isDevSignupBypassEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_DEV_SIGNUP_OTP?.trim();
  return v != null && v.length > 0;
}

/** Returns the fixed sample code when dev bypass is enabled, else null. */
function getDevSignupOtp(): string | null {
  return isDevSignupBypassEnabled() ? DEV_SIGNUP_OTP_SAMPLE : null;
}

function isSupabaseEmailRateLimit(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const o = err as { message?: unknown; code?: unknown };
  const code = typeof o.code === 'string' ? o.code : '';
  const msg = typeof o.message === 'string' ? o.message.toLowerCase() : '';
  return code === 'over_email_send_rate_limit' || msg.includes('rate limit') || msg.includes('over_email_send');
}

async function requestSignupEmailOtp(emailAddr: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email: emailAddr,
    options: { shouldCreateUser: true },
  });
  if (otpErr) throw otpErr;
}

export default function SignupPage() {
  const router = useRouter();
  const { data: publicBranding } = usePublicBranding();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchContactEmail, setBranchContactEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiLink, setUpiLink] = useState('');
  const [branchLogoFile, setBranchLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const devSupabaseAccessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  const logoUrl = publicBranding?.logoUrl
    ? publicBranding.logoUrl.startsWith('http')
      ? publicBranding.logoUrl
      : `${getApiOrigin()}${publicBranding.logoUrl}`
    : null;

  const supabaseReady = isSupabaseConfigured();
  const devSignupOtp = getDevSignupOtp();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError(new Error(parsed.error.errors[0]?.message ?? 'Invalid email'));
      return;
    }
    if (!devSignupOtp && !supabaseReady) {
      setError(new Error('Email sign-up is not available right now.'));
      return;
    }
    setLoading(true);
    try {
      if (devSignupOtp) {
        devSupabaseAccessTokenRef.current = null;
        setEmail(parsed.data.email);
        setOtpCode('');
        setStep('otp');
        return;
      }
      await requestSignupEmailOtp(parsed.data.email);
      setEmail(parsed.data.email);
      setOtpCode('');
      setStep('otp');
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err);
      if (isSupabaseEmailRateLimit(err)) {
        setResendCooldown(RATE_LIMIT_COOLDOWN_SEC);
      }
    } finally {
      setLoading(false);
    }
  }

  const resendOtp = useCallback(async () => {
    if (!email.trim() || resendCooldown > 0) return;
    if (isDevSignupBypassEnabled()) {
      setResendCooldown(RESEND_COOLDOWN_SEC);
      return;
    }
    if (!supabaseReady) return;
    setError(null);
    setLoading(true);
    try {
      await requestSignupEmailOtp(email.trim());
      setOtpCode('');
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err);
      if (isSupabaseEmailRateLimit(err)) {
        setResendCooldown(RATE_LIMIT_COOLDOWN_SEC);
      }
    } finally {
      setLoading(false);
    }
  }, [email, resendCooldown, supabaseReady]);

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = otpSchema.safeParse({ code: otpCode.trim() });
    if (!parsed.success) {
      setError(new Error(parsed.error.errors[0]?.message ?? 'Invalid code'));
      return;
    }
    setLoading(true);
    try {
      const dev = getDevSignupOtp();
      if (dev && parsed.data.code === dev) {
        const { data } = await api.post<{ accessToken: string }>('/auth/admin/signup/dev-supabase-session', {
          email: email.trim(),
        });
        devSupabaseAccessTokenRef.current = data.accessToken;
        setOtpCode('');
        setStep('account');
        return;
      }
      const supabase = getSupabaseBrowserClient();
      const { data, error: vErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: parsed.data.code,
        type: 'email',
      });
      if (vErr) throw vErr;
      if (!data.session?.access_token) {
        throw new Error('No session after verification');
      }
      devSupabaseAccessTokenRef.current = null;
      setOtpCode('');
      setStep('account');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function completeSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = accountSchema.safeParse({
      password,
      name: name.trim() || undefined,
      branchName: branchName.trim(),
      branchAddress: branchAddress.trim(),
      branchPhone: branchPhone.trim(),
      branchContactEmail: branchContactEmail.trim() || undefined,
      gstNumber: gstNumber.trim() || undefined,
      panNumber: panNumber.trim() || undefined,
      footerNote: footerNote.trim() || undefined,
      upiId: upiId.trim() || undefined,
      upiPayeeName: upiPayeeName.trim() || undefined,
      upiLink: upiLink.trim() || undefined,
    });
    if (!parsed.success) {
      setError(new Error(parsed.error.errors[0]?.message ?? 'Check the form'));
      return;
    }
    setLoading(true);
    try {
      let accessToken = devSupabaseAccessTokenRef.current;
      if (!accessToken) {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;
        accessToken = sessionData.session?.access_token ?? null;
      }
      if (!accessToken) {
        throw new Error('Session expired. Go back and request a new code.');
      }

      const form = new FormData();
      form.append('email', email.trim());
      form.append('password', parsed.data.password);
      if (parsed.data.name?.trim()) form.append('name', parsed.data.name.trim());
      form.append('branchName', parsed.data.branchName);
      form.append('branchAddress', parsed.data.branchAddress);
      form.append('branchPhone', parsed.data.branchPhone);
      if (parsed.data.branchContactEmail?.trim()) {
        form.append('branchContactEmail', parsed.data.branchContactEmail.trim());
      }
      if (parsed.data.gstNumber?.trim()) form.append('gstNumber', parsed.data.gstNumber.trim());
      if (parsed.data.panNumber?.trim()) form.append('panNumber', parsed.data.panNumber.trim());
      if (parsed.data.footerNote?.trim()) form.append('footerNote', parsed.data.footerNote.trim());
      if (parsed.data.upiId?.trim()) form.append('upiId', parsed.data.upiId.trim());
      if (parsed.data.upiPayeeName?.trim()) form.append('upiPayeeName', parsed.data.upiPayeeName.trim());
      if (parsed.data.upiLink?.trim()) form.append('upiLink', parsed.data.upiLink.trim());
      if (branchLogoFile) form.append('branchLogo', branchLogoFile);

      const { data } = await api.post<{
        token: string;
        user: { id: string; email: string; role: AuthUser['role']; branchId: string | null };
        onboardingCompletedAt: string | null;
      }>('/auth/admin/signup/complete', form, { headers: { Authorization: `Bearer ${accessToken}` } });

      devSupabaseAccessTokenRef.current = null;
      if (isSupabaseConfigured()) {
        try {
          await getSupabaseBrowserClient().auth.signOut();
        } catch {
          /* ignore */
        }
      }

      setToken(data.token);
      setStoredUser({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        branchId: data.user.branchId,
        onboardingCompletedAt: data.onboardingCompletedAt ?? null,
      });
      router.replace('/onboarding');
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-white lg:flex-row"
      style={
        {
          '--primary': '221 83% 43%',
          '--ring': '221 83% 43%',
        } as CSSProperties
      }
    >
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-slate-100 lg:h-auto lg:min-h-screen lg:w-1/2">
        <Image
          src="/images/login-hero.png"
          alt="Laundry professional beside a washing machine"
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
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Create branch account</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Verify your work email, then set your branch and password. You will be the branch head for this
                branch and can add a logo and billing details now or on the next screen.
              </p>
            </div>
          </div>

          {!devSignupOtp && !supabaseReady ? (
            <p className="text-sm text-destructive">Email sign-up is not available right now.</p>
          ) : null}

          {step === 'email' ? (
            <form onSubmit={sendOtp} className="space-y-5">
              {error ? <ErrorDisplay error={error} /> : null}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Work email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@yourlaundry.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                />
              </div>
              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-slate-800 text-base font-medium text-white hover:bg-slate-900"
                disabled={loading || (!devSignupOtp && !supabaseReady) || resendCooldown > 0}
              >
                {loading
                  ? 'Sending code…'
                  : resendCooldown > 0
                    ? `Wait ${resendCooldown}s before sending again`
                    : 'Send verification code'}
              </Button>
            </form>
          ) : null}

          {step === 'otp' ? (
            <form onSubmit={verifyOtp} className="space-y-5">
              {error ? <ErrorDisplay error={error} /> : null}
              <p className="text-sm text-slate-600">
                Enter the <span className="font-medium">one-time code</span> from your email (
                {`${EMAIL_OTP_MIN_LEN}–${EMAIL_OTP_MAX_LEN}`} digits) for{' '}
                <span className="font-medium text-slate-800">{email}</span>.
              </p>
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium text-slate-700">
                  Verification code
                </label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={`${'0'.repeat(EMAIL_OTP_MIN_LEN)}`}
                  maxLength={EMAIL_OTP_MAX_LEN}
                  value={otpCode}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, EMAIL_OTP_MAX_LEN);
                    setOtpCode(digits);
                  }}
                  className="border-slate-200 bg-sky-50/60 font-mono text-lg tracking-widest text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep('email')}>
                  Back
                </Button>
                <Button
                  type="submit"
                  className="h-11 flex-1 rounded-lg bg-slate-800 text-base font-medium text-white hover:bg-slate-900"
                  disabled={
                    loading ||
                    otpCode.length < EMAIL_OTP_MIN_LEN ||
                    otpCode.length > EMAIL_OTP_MAX_LEN
                  }
                >
                  {loading ? 'Verifying…' : 'Verify'}
                </Button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-slate-600 underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void resendOtp()}
                  disabled={loading || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          ) : null}

          {step === 'account' ? (
            <form onSubmit={completeSignup} className="space-y-5">
              {error ? <ErrorDisplay error={error} /> : null}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Admin password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-slate-700">
                  Your name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="branchName" className="text-sm font-medium text-slate-700">
                  Branch name
                </label>
                <Input
                  id="branchName"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="branchAddress" className="text-sm font-medium text-slate-700">
                  Branch address
                </label>
                <Input
                  id="branchAddress"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="branchPhone" className="text-sm font-medium text-slate-700">
                  Branch phone
                </label>
                <Input
                  id="branchPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210 or 9876543210"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                />
              </div>

              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-medium text-slate-800">Branch branding (optional)</p>
                <p className="text-xs text-slate-500">
                  Logo and details are stored on your branch. You can change them later in Branding or onboarding.
                </p>
                <div className="space-y-2">
                  <label htmlFor="branchLogo" className="text-sm font-medium text-slate-700">
                    Branch logo
                  </label>
                  <Input
                    id="branchLogo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="cursor-pointer border-slate-200 bg-white text-sm text-slate-800 [&:not(:placeholder-shown)]:text-slate-800 file:mr-3 file:rounded file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-sky-900 hover:file:bg-sky-200"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) {
                        setBranchLogoFile(null);
                        return;
                      }
                      if (!f.type.startsWith('image/')) {
                        setError(new Error('Please choose a PNG, JPG, or WebP image.'));
                        e.target.value = '';
                        setBranchLogoFile(null);
                        return;
                      }
                      if (f.size > 5 * 1024 * 1024) {
                        setError(new Error('Logo must be 5 MB or smaller.'));
                        e.target.value = '';
                        setBranchLogoFile(null);
                        return;
                      }
                      setError(null);
                      setBranchLogoFile(f);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="branchContactEmail" className="text-sm font-medium text-slate-700">
                    Public branch email <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="branchContactEmail"
                    type="email"
                    placeholder="contact@mylaundry.com"
                    value={branchContactEmail}
                    onChange={(e) => setBranchContactEmail(e.target.value)}
                    className="border-slate-200 bg-white font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="gstNumber" className="text-sm font-medium text-slate-700">
                      GST number <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <Input
                      id="gstNumber"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      className="border-slate-200 bg-white font-normal text-slate-900 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="panNumber" className="text-sm font-medium text-slate-700">
                      PAN <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <Input
                      id="panNumber"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      className="border-slate-200 bg-white font-normal text-slate-900 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="upiId" className="text-sm font-medium text-slate-700">
                    UPI ID <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="upiId"
                    placeholder="name@bank"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="border-slate-200 bg-white font-normal text-slate-900 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="upiPayeeName" className="text-sm font-medium text-slate-700">
                    UPI payee name <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="upiPayeeName"
                    value={upiPayeeName}
                    onChange={(e) => setUpiPayeeName(e.target.value)}
                    className="border-slate-200 bg-white font-normal text-slate-900 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="upiLink" className="text-sm font-medium text-slate-700">
                    UPI payment link <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="upiLink"
                    type="url"
                    placeholder="https://…"
                    value={upiLink}
                    onChange={(e) => setUpiLink(e.target.value)}
                    className="border-slate-200 bg-white font-normal text-slate-900 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="footerNote" className="text-sm font-medium text-slate-700">
                    Footer note on invoices <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="footerNote"
                    value={footerNote}
                    onChange={(e) => setFooterNote(e.target.value)}
                    className="border-slate-200 bg-white font-normal text-slate-900 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-slate-800 text-base font-medium text-white hover:bg-slate-900"
                disabled={loading}
              >
                {loading ? 'Creating…' : 'Create account'}
              </Button>
            </form>
          ) : null}

          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>

          <p className="mt-6 text-center text-xs text-slate-400">
            Designed and developed by <span className="font-medium text-slate-500">Krackbot Studio</span>
          </p>
        </div>
      </div>
    </div>
  );
}
