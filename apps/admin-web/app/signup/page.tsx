'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { api, getApiError } from '@/lib/api';
import { setToken, setStoredUser, type AuthUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { toast } from 'sonner';

/** Brevo email OTP is 6 digits. */
const EMAIL_OTP_MIN_LEN = 6;
const EMAIL_OTP_MAX_LEN = 6;
const EMAIL_OTP_LABEL =
  EMAIL_OTP_MIN_LEN === EMAIL_OTP_MAX_LEN
    ? `${EMAIL_OTP_MIN_LEN}`
    : `${EMAIL_OTP_MIN_LEN}–${EMAIL_OTP_MAX_LEN}`;

const emailSchema = z.object({
  email: z.string().email('Invalid email'),
});

const otpSchema = z.object({
  code: z
    .string()
    .regex(
      new RegExp(`^\\d{${EMAIL_OTP_MIN_LEN},${EMAIL_OTP_MAX_LEN}}$`),
      `Enter the code from your email (${EMAIL_OTP_LABEL} digits, numbers only)`,
    ),
});

const accountSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
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
  });

type Step = 'email' | 'otp' | 'account';
type AccountSection = 'password' | 'branch';

const RESEND_COOLDOWN_SEC = 60;

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

function normalizeSignupEmailStepError(err: unknown): Error {
  const apiErr = getApiError(err);
  const msg = (apiErr.message || '').toLowerCase();
  if (
    apiErr.status === 409 ||
    msg.includes('already exists') ||
    msg.includes('already registered')
  ) {
    return new Error('This email already has an account. Please sign in or use a different email.');
  }
  return new Error(apiErr.message || 'Could not send verification code. Try again.');
}

function isExistingAccountInfo(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return message.toLowerCase().includes('already has an account');
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [accountSection, setAccountSection] = useState<AccountSection>('password');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchLogoFile, setBranchLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [otpErrorMessage, setOtpErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const signupAccessTokenRef = useRef<string | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const branchLogoPreviewUrl = useMemo(
    () => (branchLogoFile ? URL.createObjectURL(branchLogoFile) : null),
    [branchLogoFile],
  );

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    rightPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, accountSection]);

  useEffect(() => {
    return () => {
      if (branchLogoPreviewUrl) URL.revokeObjectURL(branchLogoPreviewUrl);
    };
  }, [branchLogoPreviewUrl]);

  const devSignupOtp = getDevSignupOtp();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError(new Error(parsed.error.errors[0]?.message ?? 'Invalid email'));
      return;
    }
    setLoading(true);
    try {
      if (devSignupOtp) {
        signupAccessTokenRef.current = null;
        setEmail(parsed.data.email);
        setOtpCode('');
        setStep('otp');
        return;
      }
      await api.post('/auth/admin/signup/request-email-otp', { email: parsed.data.email });
      setEmail(parsed.data.email);
      setOtpCode('');
      setStep('otp');
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(normalizeSignupEmailStepError(err));
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
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/admin/signup/request-email-otp', { email: email.trim() });
      setOtpCode('');
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(normalizeSignupEmailStepError(err));
    } finally {
      setLoading(false);
    }
  }, [email, resendCooldown]);

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOtpErrorMessage('');
    const parsed = otpSchema.safeParse({ code: otpCode.trim() });
    if (!parsed.success) {
      setOtpErrorMessage(parsed.error.errors[0]?.message ?? 'Invalid code');
      return;
    }
    setLoading(true);
    try {
      const dev = getDevSignupOtp();
      if (dev && parsed.data.code === dev) {
        const { data } = await api.post<{ accessToken: string }>('/auth/admin/signup/verify-email-otp', {
          email: email.trim(),
          otp: parsed.data.code,
        });
        signupAccessTokenRef.current = data.accessToken;
        setOtpCode('');
        setAccountSection('password');
        setStep('account');
        return;
      }
      const { data } = await api.post<{ accessToken: string }>('/auth/admin/signup/verify-email-otp', {
        email: email.trim(),
        otp: parsed.data.code,
      });
      if (!data.accessToken) {
        throw new Error('No signup session after verification');
      }
      signupAccessTokenRef.current = data.accessToken;
      setOtpCode('');
      setAccountSection('password');
      setStep('account');
    } catch (err) {
      const apiErr = getApiError(err);
      const msg = (apiErr.message || '').toLowerCase();
      if (msg.includes('invalid verification code')) {
        setOtpErrorMessage('Wrong verification code. Please check the code and try again.');
      } else if (msg.includes('expired')) {
        setOtpErrorMessage('Verification code expired. Please resend and try again.');
      } else if (apiErr.status === 401) {
        setOtpErrorMessage('Wrong verification code. Please check the code and try again.');
      } else {
        setError(err);
      }
      setStep('otp');
    } finally {
      setLoading(false);
    }
  }

  async function completeSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(new Error('Password must be at least 8 characters.'));
      setAccountSection('password');
      return;
    }
    if (password !== confirmPassword) {
      setError(new Error('Passwords do not match.'));
      setAccountSection('password');
      return;
    }
    const parsed = accountSchema.safeParse({
      password,
      branchName: branchName.trim(),
      branchAddress: branchAddress.trim(),
      branchPhone: branchPhone.trim(),
    });
    if (!parsed.success) {
      setError(new Error(parsed.error.errors[0]?.message ?? 'Check the form'));
      return;
    }
    setLoading(true);
    try {
      const accessToken = signupAccessTokenRef.current;
      if (!accessToken) {
        throw new Error('Session expired. Go back and request a new code.');
      }

      const form = new FormData();
      form.append('email', email.trim());
      form.append('password', parsed.data.password);
      form.append('branchName', parsed.data.branchName);
      form.append('branchAddress', parsed.data.branchAddress);
      form.append('branchPhone', parsed.data.branchPhone);
      if (branchLogoFile) form.append('branchLogo', branchLogoFile);

      const { data } = await api.post<{
        token: string;
        user: { id: string; email: string; role: AuthUser['role']; branchId: string | null };
        onboardingCompletedAt: string | null;
      }>('/auth/admin/signup/complete', form, { headers: { Authorization: `Bearer ${accessToken}` } });

      signupAccessTokenRef.current = null;

      setToken(data.token);
      setStoredUser({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        branchId: data.user.branchId,
        onboardingCompletedAt: data.onboardingCompletedAt ?? null,
      });
      sessionStorage.setItem('onboarding_welcome', '1');
      toast.success('Congrats! Branch and account created. Taking you to finish branch setup.');
      // Full navigation avoids stale auth/layout state during first OPS signup.
      window.location.assign('/onboarding');
    } catch (err) {
      const apiErr = getApiError(err);
      if (apiErr.status === 401 || apiErr.status === 403) {
        setError(new Error('Signup session expired. Please verify your email again.'));
      } else if (apiErr.status === 409) {
        setError(new Error(apiErr.message || 'This email is already registered. Please sign in.'));
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

      <div ref={rightPanelRef} className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:h-screen lg:w-1/2 lg:overflow-y-auto lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8 space-y-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Create branch account</h1>
            </div>
          </div>

          {step === 'email' ? (
            <form onSubmit={sendOtp} className="space-y-5">
              {error ? (
                isExistingAccountInfo(error) ? (
                  <div className="rounded-md border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-sm text-amber-800">
                    <p>{(error as { message?: string }).message ?? 'This email already has an account.'}</p>
                  </div>
                ) : (
                  <ErrorDisplay error={error} />
                )
              ) : null}
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
                disabled={loading || resendCooldown > 0}
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
              {otpErrorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {otpErrorMessage}
                </div>
              ) : null}
              <p className="text-sm text-slate-600">
                Enter the <span className="font-medium">one-time code</span> from your email ({EMAIL_OTP_LABEL} digits) for{' '}
                <span className="font-medium text-slate-800">{email}</span>.
              </p>
              <p className="text-xs text-amber-700">
                Did not receive the code? Please check your spam/junk folder.
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
                  Change email ID
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
              {accountSection === 'password' ? (
                <>
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
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                      Confirm password
                    </label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="border-slate-200 bg-sky-50/60 font-normal text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400 [&:not(:placeholder-shown)]:text-slate-800"
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-11 w-full rounded-lg bg-slate-800 text-base font-medium text-white hover:bg-slate-900"
                    onClick={() => {
                      setError(null);
                      if (password.length < 8) {
                        setError(new Error('Password must be at least 8 characters.'));
                        return;
                      }
                      if (password !== confirmPassword) {
                        setError(new Error('Passwords do not match.'));
                        return;
                      }
                      setAccountSection('branch');
                    }}
                  >
                    Next
                  </Button>
                </>
              ) : (
                <>
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
                    <label htmlFor="branchLogo" className="text-sm font-medium text-slate-700">
                      Branch logo <span className="font-normal text-slate-400">(optional)</span>
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
                  {branchLogoPreviewUrl ? (
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <img
                        src={branchLogoPreviewUrl}
                        alt="Branch logo preview"
                        className="h-20 w-auto max-w-full rounded object-contain"
                      />
                    </div>
                  ) : null}
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
                      Branch mobile number
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setAccountSection('password')}>
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="h-11 flex-1 rounded-lg bg-slate-800 text-base font-medium text-white hover:bg-slate-900"
                      disabled={loading}
                    >
                      {loading ? 'Creating…' : 'Continue to onboarding'}
                    </Button>
                  </div>
                </>
              )}
            </form>
          ) : null}

          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
              Sign in
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
                  width={20}
                  height={20}
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
