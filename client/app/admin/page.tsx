// dopekuts/app/admin/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Shield, Lock } from 'lucide-react';
import { requestOtp, verifyOtpAndLogin } from '../../lib/api/auth';

export default function AdminLogin() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const primaryButtonClass =
    'group relative w-full overflow-hidden rounded-lg bg-white text-black font-semibold border border-gray-300 shadow-[0_14px_40px_rgba(0,0,0,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gradient-to-r hover:from-white hover:to-gray-100 hover:shadow-[0_22px_60px_rgba(0,0,0,0.75)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed';

  const backButtonClass =
    'w-full rounded-lg border border-gray-700/80 bg-transparent text-gray-200 text-sm font-medium hover:bg-gray-800 hover:border-gray-500 hover:text-white transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white focus-visible:ring-offset-gray-900';

  const subtlePillClass =
    'inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-300 border border-white/10';

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError(null);

    try {
      await requestOtp({ email });
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setIsLoading(true);
    setError(null);

    try {
      await verifyOtpAndLogin({ email, otp });
      localStorage.setItem('admin_authenticated', 'true');
      router.push('/admin/booking');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP or verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center relative overflow-hidden">
      {/* Soft glow accents */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-white/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gray-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="container-max section-padding py-10">
        <div className="max-w-md mx-auto">
          {/* Top header / brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md shadow-black/40">
                <Shield className="h-4 w-4 text-black" />
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-gray-300">
                Dopecuts Admin
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-semibold text-white mb-2">
              Secure Admin Login
            </h1>
            <p className="text-gray-300 text-sm md:text-base">
              {step === 'email'
                ? 'Use your authorized email to receive a one-time access code.'
                : 'Enter the authentication code we just sent to your inbox.'}
            </p>
          </div>

          <Card className="bg-gray-900/85 border border-white/10 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.9)] rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">
                    {step === 'email' ? '1' : '2'}
                  </span>
                  {step === 'email' ? 'Verify your email' : 'Enter authentication code'}
                </CardTitle>
                <span className="text-[10px] uppercase tracking-[0.22em] text-gray-400">
                  {step === 'email' ? 'Step 1 of 2' : 'Step 2 of 2'}
                </span>
              </div>

              <CardDescription className="text-gray-300 text-sm">
                {step === 'email'
                  ? "We'll send a secure one-time code to your admin email."
                  : `Code sent securely to ${email}`}
              </CardDescription>

              <div className="mt-3 flex items-center justify-between">
                <span className={subtlePillClass}>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Security enforced with one-time codes
                </span>
                <span className="hidden sm:inline text-[11px] text-gray-400">
                  Access is monitored & protected
                </span>
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              {error && (
                <div className="mb-4 text-center text-sm text-red-300 bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {step === 'email' ? (
                <form onSubmit={handleEmailSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="email" className="text-white font-medium text-sm">
                      Admin Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@dopecuts.com"
                      className="mt-2 bg-gray-900 border border-gray-700 text-white placeholder:text-gray-500 rounded-lg focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                      required
                    />
                    <p className="mt-2 text-xs text-gray-400">
                      Only whitelisted admin accounts will be able to authenticate.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className={primaryButtonClass}
                    disabled={isLoading || !email}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                        Sending code...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span>Send verification code</span>
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleOtpSubmit} className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="otp"
                        className="text-white font-medium text-sm flex items-center gap-2"
                      >
                        <Lock className="h-4 w-4 text-gray-300" />
                        Authentication Code
                      </Label>
                      <span className="text-[11px] text-gray-400">
                        {otp.length}/6 digits
                      </span>
                    </div>

                    <Input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••••"
                      className="mt-3 bg-gray-950 border border-gray-700 text-white text-center text-2xl tracking-[0.5em] px-4 py-5 rounded-xl focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                      maxLength={6}
                      required
                    />

                    <div className="mt-3 text-xs text-gray-400">
                      <p>Check your inbox and spam folder for the latest code.</p>
                      <p>If you requested multiple codes, only the most recent one works.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      className={primaryButtonClass}
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                          Verifying...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Verify &amp; enter dashboard</span>
                          <Lock className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                        </div>
                      )}
                    </Button>

                    {/* Back to email – fixed text visibility */}
                    <Button
                      type="button"
                      className={backButtonClass}
                      onClick={() => {
                        setStep('email');
                        setError(null);
                        setOtp('');
                      }}
                    >
                      Back to email
                    </Button>

                    <p className="text-[11px] text-center text-gray-500 mt-1">
                      Having trouble? Request a new code or contact the system owner to
                      confirm your access.
                    </p>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}