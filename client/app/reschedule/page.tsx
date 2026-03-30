'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { isValidPhoneNumber } from 'libphonenumber-js';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Phone,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import moment from 'moment';

// Dialog (shadcn/ui)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

// API
import {
  startPhoneOtp,
  verifyPhoneOtp,
  startEmailOtp,
  verifyEmailOtp,
  getManageBooking,
  updateBookingPublic,
  cancelBookingPublic,
  type IBooking,
} from '@/lib/api/booking';
import { getAvailability } from '@/lib/api/calendar';

// --- Helpers ---

const ADAPTIVE_SERVICE_RULES: Array<{ keywords: string[]; duration: number }> = [
  { keywords: ['kids cut', 'kid cut'], duration: 20 },
  { keywords: ['hair line up', 'hair line-up', 'hair lineup', 'lineup'], duration: 20 },
  { keywords: ['beard trim'], duration: 20 },
  { keywords: ['deluxe'], duration: 60 },
];

const DEFAULT_SLOT_DURATION = 40;

function getAdaptiveDuration(serviceName?: string, baseDuration?: number) {
  const normalizedName = (serviceName || '').toLowerCase();
  const rule = ADAPTIVE_SERVICE_RULES.find((r) =>
    r.keywords.some((keyword) => normalizedName.includes(keyword))
  );
  if (rule) return rule.duration;
  const normalizedBase = baseDuration || DEFAULT_SLOT_DURATION;
  return Math.max(normalizedBase, DEFAULT_SLOT_DURATION);
}

// Generate available dates (2 weeks in advance, skipping Sundays)
const generateAvailableDates = () => {
  const dates: {
    date: string;
    display: string;
    dayName: string;
    isToday: boolean;
    isTomorrow: boolean;
  }[] = [];
  const today = moment();

  for (let i = 0; i < 14; i++) {
    const date = today.clone().add(i, 'days');
    if (date.day() !== 0) {
      dates.push({
        date: date.format('YYYY-MM-DD'),
        display: date.format('MMM DD'),
        dayName: date.format('ddd'),
        isToday: i === 0,
        isTomorrow: i === 1,
      });
    }
  }
  return dates;
};

const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

type Appointment = {
  id: string;
  service: string;
  price: number;
  duration: number;
  serviceId?: string;
  date: string; // YYYY-MM-DD
  time: string; // '1:30 PM'
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

function normalizeBooking(b: IBooking): Appointment {
  return {
    id: b._id,
    service: b.service,
    price: b.price,
    duration: b.duration,
    serviceId: b.serviceId,
    date: moment(b.date).format('YYYY-MM-DD'),
    time: b.time,
    firstName: b.firstName,
    lastName: b.lastName || '',
    phone: b.phone,
    email: b.email,
  };
}

// --- Component ---

export default function RescheduleAppointment() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Identity verification
  const [verifyMethod, setVerifyMethod] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [verified, setVerified] = useState(false);
  const [manageToken, setManageToken] = useState<string>('');

  // Existing appointment (fetched after verification)
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  // New schedule selection
  const [availableDates] = useState(generateAvailableDates());
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');

  // Finalize
  const [showSuccess, setShowSuccess] = useState(false);

  // Cancel modal + success
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);

  // UX state
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const canContinueFromStep2 = Boolean(newDate && newTime);
  const canContinueFromStep1 = verified; // You only move on once verified

  // Load available times for the selected date/service
  useEffect(() => {
    if (!appointment || !newDate) return;
    let cancelled = false;
    const load = async () => {
      setLoadingSlots(true);
      setSlotsError(null);
      setTimeSlots([]);
      try {
        const effectiveDuration = getAdaptiveDuration(appointment.service, appointment.duration);
        const params: { serviceId?: string; serviceDuration?: number } = {};
        if (appointment.serviceId) {
          params.serviceId = appointment.serviceId;
        } else if (effectiveDuration) {
          params.serviceDuration = effectiveDuration;
        }
        const slots = await getAvailability(newDate, params);
        if (!cancelled) setTimeSlots(slots);
      } catch (err: any) {
        if (!cancelled) {
          setSlotsError(err?.response?.data?.message || 'Failed to load available times.');
          setTimeSlots([]);
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [appointment, newDate]);

  // API: Send OTP
  const handleSendCode = async () => {
    setErrorMsg('');
    try {
      setLoadingSend(true);
      if (verifyMethod === 'phone') {
        if (!phone || !isValidPhoneNumber(phone)) return;
        await startPhoneOtp({ phone });
      } else {
        if (!email || !validateEmail(email)) return;
        await startEmailOtp({ email });
      }
      setCodeSent(true);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to send code. Try again.');
    } finally {
      setLoadingSend(false);
    }
  };

  // API: Verify OTP → get token → fetch booking
  const handleVerifyCode = async () => {
    setErrorMsg('');
    if (codeInput.trim().length !== 6) return;
    try {
      setLoadingVerify(true);
      let token = '';
      if (verifyMethod === 'phone') {
        const out = await verifyPhoneOtp({ phone, otp: codeInput.trim() });
        token = out.token;
      } else {
        const out = await verifyEmailOtp({ email, otp: codeInput.trim() });
        token = out.token;
      }
      setManageToken(token);

      const manage = await getManageBooking(token);
      const appt = normalizeBooking(manage.booking);
      setAppointment(appt);

      // Preselect current appointment date/time for convenience
      setNewDate(appt.date);
      setNewTime(appt.time);

      setVerified(true);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Verification failed. Check your code and try again.');
    } finally {
      setLoadingVerify(false);
    }
  };

  // API: Reschedule
  const handleConfirmReschedule = async () => {
    if (!appointment || !newDate || !newTime || !manageToken) return;
    setErrorMsg('');
    try {
      setLoadingUpdate(true);
      const { booking } = await updateBookingPublic(
        appointment.id,
        { date: newDate, time: newTime },
        manageToken
      );
      const updated = normalizeBooking(booking);
      setAppointment(updated);
      setShowSuccess(true);
      setStep(4);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to reschedule appointment.');
    } finally {
      setLoadingUpdate(false);
    }
  };

  // API: Cancel
  const handleConfirmCancel = async () => {
    if (!appointment || !manageToken) return;
    setErrorMsg('');
    try {
      setLoadingCancel(true);
      await cancelBookingPublic(appointment.id, {}, manageToken);
      setShowCancelModal(false);
      setShowCancelSuccess(true);
      // Optionally clear appointment state afterwards
      setAppointment(null);
      setNewDate('');
      setNewTime('');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to cancel appointment.');
    } finally {
      setLoadingCancel(false);
    }
  };

  // Redirect to home after the user acknowledges success screens
  const handleDone = () => {
    setShowSuccess(false);
    setShowCancelSuccess(false);
    // redirect to home
    router.push('/');
  };

  // UI helpers
  const StepPill = ({ index, current }: { index: number; current: number }) => {
    const isCompletedOrActive = current >= index;
    const isActive = current === index;
    return (
      <div className="flex items-center">
        <div
          className={[
            'w-8 h-8 lg:w-12 lg:h-12 rounded-full flex items-center justify-center',
            'text-xs lg:text-sm font-bold leading-none tracking-tight',
            'transition-all duration-300 select-none',
            isCompletedOrActive ? 'bg-white text-black shadow-lg' : 'bg-gray-700 text-gray-400 border-2 border-gray-600',
          ].join(' ')}
          aria-current={isActive ? 'step' : undefined}
        >
          {index}
        </div>
        {index < 4 && (
          <div className={`w-8 lg:w-16 h-1 transition-all duration-300 ${current > index ? 'bg-white' : 'bg-gray-700'}`} />
        )}
      </div>
    );
  };

  // Success screen (rescheduled)
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-xl w-full">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-white text-2xl">Appointment Rescheduled</CardTitle>
              <CardDescription className="text-gray-300">
                You’ll receive a confirmation message shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                <h4 className="text-white font-semibold mb-3">New Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Service:</span>
                    <span className="text-white font-medium">{appointment?.service}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Date:</span>
                    <span className="text-white font-medium">{moment(newDate).format('MMMM DD, YYYY')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Time:</span>
                    <span className="text-white font-medium">{newTime}</span>
                  </div>
                </div>
              </div>

              <Button onClick={handleDone} className="w-full bg-white text-black hover:bg-gray-200">
                Done
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success screen (canceled)
  if (showCancelSuccess) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-xl w-full">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-white text-2xl">Appointment Canceled</CardTitle>
              <CardDescription className="text-gray-300">
                We’ve canceled your appointment. You can book a new one anytime.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleDone} className="w-full bg-white text-black hover:bg-gray-200">
                Done
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {/* Local override for the phone number input ONLY (to match Book page) */}
      <style jsx global>{`
        .phone-input .PhoneInputInput {
          background-color: #111827 !important; /* gray-900 */
          color: #ffffff !important;
          border: 1px solid #374151 !important; /* gray-700 */
          border-radius: 0.5rem !important;
          padding: 0.5rem 0.75rem !important;
        }
        .phone-input .PhoneInputInput::placeholder {
          color: #9ca3af !important; /* gray-400 */
        }
        .phone-input .PhoneInputInput:focus {
          outline: none !important;
          border-color: #9ca3af !important; /* gray-400 */
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12) !important;
        }
      `}</style>

      {/* Header */}
      <div className="bg-black border-b border-gray-800">
        <div className="container-max section-padding py-10 lg:py-14">
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">Reschedule Appointment</h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              Verify your identity, then pick a new date and time
            </p>
            {errorMsg && <p className="text-sm text-red-400 mt-3">{errorMsg}</p>}
          </div>
        </div>
      </div>

      <div className="container-max section-padding py-8 lg:py-12">
        {/* Progress */}
        <div className="flex justify-center mb-8 lg:mb-12">
          <div className="flex items-center space-x-4">
            <StepPill index={1} current={step} />
            <StepPill index={2} current={step} />
            <StepPill index={3} current={step} />
            <StepPill index={4} current={step} />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Main */}
          <div className="xl:col-span-2 order-2 xl:order-1">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-xl lg:text-2xl flex items-center gap-3">
                  {step === 1 && (
                    <>
                      <Phone className="w-6 h-6" /> <span>Verify Identity</span>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <Calendar className="w-6 h-6" /> <span>Select New Date &amp; Time</span>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <Clock className="w-6 h-6" /> <span>Review Changes</span>
                    </>
                  )}
                  {step === 4 && (
                    <>
                      <CheckCircle2 className="w-6 h-6" /> <span>Done</span>
                    </>
                  )}
                </CardTitle>
                <CardDescription className="text-gray-300 text-base lg:text-lg">
                  {step === 1 && 'Use your phone or email to verify your appointment'}
                  {step === 2 && 'Choose a new date and time that works for you'}
                  {step === 3 && 'Confirm the details before finalizing the change'}
                  {step === 4 && 'Your appointment has been rescheduled'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-8">
                {/* Step 1: Verify */}
                {step === 1 && (
                  <div className="space-y-8">
                    {/* Verification method toggle (fixed selected + hover states) */}
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        aria-pressed={verifyMethod === 'phone'}
                        onClick={() => {
                          setVerifyMethod('phone');
                          setEmail('');
                          setCodeSent(false);
                          setCodeInput('');
                          setVerified(false);
                          setErrorMsg('');
                        }}
                        className={`flex-1 text-sm font-medium border ${
                          verifyMethod === 'phone'
                            ? 'bg-white text-black border-white shadow-lg hover:bg-white hover:text-black'
                            : 'bg-gray-800 text-gray-200 border-gray-600 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        Use Phone
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        aria-pressed={verifyMethod === 'email'}
                        onClick={() => {
                          setVerifyMethod('email');
                          setPhone('');
                          setCodeSent(false);
                          setCodeInput('');
                          setVerified(false);
                          setErrorMsg('');
                        }}
                        className={`flex-1 text-sm font-medium border ${
                          verifyMethod === 'email'
                            ? 'bg-white text-black border-white shadow-lg hover:bg-white hover:text-black'
                            : 'bg-gray-800 text-gray-200 border-gray-600 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        Use Email
                      </Button>
                    </div>

                    {verifyMethod === 'phone' && (
                      <div className="space-y-4">
                        <Label className="text-white font-medium">Phone Number</Label>
                        <PhoneInput
                          international
                          defaultCountry="CA"
                          value={phone}
                          onChange={(value) => setPhone(value || '')}
                          className="phone-input"
                          style={
                            {
                              '--PhoneInputCountryFlag-height': '1em',
                              '--PhoneInputCountrySelectArrow-color': '#9CA3AF',
                              '--PhoneInput-color--focus': '#FFFFFF',
                            } as CSSProperties
                          }
                        />
                        {phone && !isValidPhoneNumber(phone) && (
                          <p className="text-red-400 text-sm">Please enter a valid phone number</p>
                        )}

                        {!codeSent ? (
                          <Button
                            onClick={handleSendCode}
                            disabled={!phone || !isValidPhoneNumber(phone) || loadingSend}
                            className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
                          >
                            {loadingSend ? 'Sending…' : 'Send Code'}
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <Label className="text-white font-medium">Enter 6-digit Code</Label>
                            <Input
                              value={codeInput}
                              onChange={(e) => setCodeInput(e.target.value)}
                              maxLength={6}
                              placeholder="Enter code"
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                            <div className="flex gap-3">
                              <Button
                                onClick={handleVerifyCode}
                                disabled={codeInput.length !== 6 || loadingVerify}
                                className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
                              >
                                {loadingVerify ? 'Verifying…' : 'Verify'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleSendCode}
                                disabled={loadingSend}
                                className="border-gray-600 text-white hover:border-blue-400 hover:bg-gray-800 transition-all duration-200"
                              >
                                {loadingSend ? 'Resending…' : 'Resend'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {verifyMethod === 'email' && (
                      <div className="space-y-4">
                        <Label className="text-white font-medium">Email Address</Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                        {email && !validateEmail(email) && (
                          <p className="text-red-400 text-sm">Please enter a valid email</p>
                        )}

                        {!codeSent ? (
                          <Button
                            onClick={handleSendCode}
                            disabled={!email || !validateEmail(email) || loadingSend}
                            className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
                          >
                            {loadingSend ? 'Sending…' : 'Send Code'}
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <Label className="text-white font-medium">Enter 6-digit Code</Label>
                            <Input
                              value={codeInput}
                              onChange={(e) => setCodeInput(e.target.value)}
                              maxLength={6}
                              placeholder="Enter code"
                              className="bg-gray-700 border-gray-600 text-white"
                            />
                            <div className="flex gap-3">
                              <Button
                                onClick={handleVerifyCode}
                                disabled={codeInput.length !== 6 || loadingVerify}
                                className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
                              >
                                {loadingVerify ? 'Verifying…' : 'Verify'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleSendCode}
                                disabled={loadingSend}
                                className="border-gray-600 text-white hover:border-blue-400 hover:bg-gray-800 transition-all duration-200"
                              >
                                {loadingSend ? 'Resending…' : 'Resend'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Select New Date & Time */}
                {step === 2 && appointment && (
                  <div className="space-y-8">
                    <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                      <h4 className="text-white font-semibold mb-3">Current Appointment</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Service:</span>
                          <span className="text-white font-medium">{appointment.service}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Duration:</span>
                          <span className="text-white font-medium">
                            {getAdaptiveDuration(appointment.service, appointment.duration)} min
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Date:</span>
                          <span className="text-white font-medium">
                            {moment(appointment.date).format('MMMM DD, YYYY')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Time:</span>
                          <span className="text-white font-medium">{appointment.time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Date Selection */}
                    <div className="space-y-4">
                      <Label className="text-white text-base lg:text-lg font-semibold">Select New Date</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {availableDates.map((d) => {
                          const active = newDate === d.date;
                          return (
                            <button
                              key={d.date}
                              onClick={() => {
                                setNewDate(d.date);
                                setNewTime('');
                              }}
                              className={`p-3 lg:p-4 rounded-lg border-2 transition-all duration-300 text-center ${
                                active
                                  ? 'border-white bg-white text-black'
                                  : 'border-gray-600 bg-gray-700 text-white hover:border-gray-400'
                              }`}
                            >
                              <div>
                                <div className="text-xs lg:text-sm font-medium">{d.dayName}</div>
                                <div className="text-sm lg:text-lg font-bold">{d.display}</div>
                                {d.isToday && <div className="text-xs text-gray-400 mt-1">Today</div>}
                                {d.isTomorrow && <div className="text-xs text-gray-400 mt-1">Tomorrow</div>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Selection */}
                    {newDate && (
                      <div className="space-y-4">
                        <Label className="text-white text-base lg:text-lg font-semibold">Select New Time</Label>
                        {loadingSlots && (
                          <p className="text-sm text-gray-300">Loading available times…</p>
                        )}
                        {slotsError && (
                          <p className="text-sm text-red-400">{slotsError}</p>
                        )}
                        {!loadingSlots && !slotsError && timeSlots.length === 0 && (
                          <p className="text-sm text-gray-300">No available times for this date.</p>
                        )}
                        {!loadingSlots && !slotsError && timeSlots.length > 0 && (
                          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {timeSlots.map((t) => {
                              const active = newTime === t;
                              return (
                                <button
                                  key={t}
                                  onClick={() => setNewTime(t)}
                                  className={`p-2 lg:p-3 rounded-lg border-2 transition-all duration-300 text-center font-medium text-sm lg:text-base ${
                                    active
                                      ? 'border-white bg-white text-black'
                                      : 'border-gray-600 bg-gray-700 text-white hover:border-gray-400'
                                  }`}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Review */}
                {step === 3 && appointment && (
                  <div className="space-y-6">
                    <div className="bg-gray-700 p-6 rounded-lg border border-gray-600">
                      <h3 className="text-lg lg:text-xl font-bold text-white mb-6">Reschedule Summary</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-600">
                          <span className="text-gray-300">Service:</span>
                          <span className="font-semibold text-white">{appointment.service}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600">
                          <span className="text-gray-300">New Date:</span>
                          <span className="font-semibold text-white">
                            {moment(newDate).format('MMMM DD, YYYY')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600">
                          <span className="text-gray-300">New Time:</span>
                          <span className="font-semibold text-white">{newTime}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-600">
                          <span className="text-gray-300">Duration:</span>
                          <span className="font-semibold text-white">{appointment.duration} minutes</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-t border-gray-500">
                          <span className="text-base lg:text-lg font-semibold text-white">Total:</span>
                          <span className="text-xl lg:text-2xl font-bold text-white">
                            ${appointment.price}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-900/30 border border-blue-700 p-6 rounded-lg">
                      <h4 className="font-semibold text-white mb-3">Heads up</h4>
                      <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>Please arrive 10–15 minutes early</li>
                        <li>Typical wait time is 5–7 minutes</li>
                        <li>Cancellations must be made 24 hours in advance</li>
                        <li>You’ll receive a confirmation SMS or email</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="xl:col-span-1 order-1 xl:order-2">
            <div className="xl:sticky xl:top-8">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Appointment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {appointment ? (
                    <>
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Service</h4>
                        <p className="text-gray-300 text-sm mb-2">
                          {appointment.duration} minutes
                        </p>
                        <p className="text-xl font-bold text-white">{appointment.service}</p>
                        <p className="text-gray-300 mt-1">${appointment.price}</p>
                      </div>

                      <div className="p-4 bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Currently Scheduled</h4>
                        <p className="text-gray-300">
                          {moment(appointment.date).format('MMMM DD, YYYY')}
                        </p>
                        <p className="text-gray-300">{appointment.time}</p>
                      </div>

                      {newDate && (
                        <div className="p-4 bg-gray-700 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">New Selection</h4>
                          <p className="text-gray-300">
                            {moment(newDate).format('MMMM DD, YYYY')}
                          </p>
                          <p className="text-gray-300">{newTime || '-'}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 bg-gray-700 rounded-lg">
                      <h4 className="font-semibold text-white mb-2">Verify to Load Details</h4>
                      <p className="text-gray-300 text-sm">
                        Start by verifying your phone or email to fetch your appointment.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-40">
        <div className="container-max section-padding">
          <div className="flex justify-between items-center">
            {/* Left button: Back by default; at Step 2 it becomes "Cancel appointment" */}
            {step === 2 ? (
              <Button
                onClick={() => setShowCancelModal(true)}
                className="bg-red-600 text-white border border-transparent hover:border-blue-400 hover:bg-red-500 hover:shadow-lg transition-all duration-200"
                disabled={loadingCancel}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel appointment
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (step === 3) setStep(2);
                  else setStep(1);
                }}
                disabled={step === 1}
                className={`${step === 1 ? 'invisible' : ''} bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200`}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}

            {/* Right button */}
            {step === 1 && (
              <Button
                onClick={() => setStep(2)}
                disabled={!canContinueFromStep1}
                className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {step === 2 && (
              <Button
                onClick={() => setStep(3)}
                disabled={!canContinueFromStep2}
                className="bg-white text-black hover:bg-gray-200"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {step === 3 && (
              <Button
                onClick={handleConfirmReschedule}
                className="bg-white text-black hover:bg-gray-200"
                disabled={loadingUpdate}
              >
                {loadingUpdate ? 'Updating…' : 'Confirm Reschedule'}
              </Button>
            )}

            {step === 4 && (
              <Button onClick={handleDone} className="bg-white text-black hover:bg-gray-200">
                Done
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="bg-gray-800 border border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Cancel appointment?
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              This will cancel your current appointment. You can rebook at any time.
            </DialogDescription>
          </DialogHeader>

          {appointment && (
            <div className="bg-gray-700 p-4 rounded-lg border border-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-300">Name:</span>
                <span className="text-white font-medium">
                  {appointment.firstName} {appointment.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Service:</span>
                <span className="text-white font-medium">{appointment.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Date:</span>
                <span className="text-white font-medium">
                  {moment(appointment.date).format('MMMM DD, YYYY')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Time:</span>
                <span className="text-white font-medium">{appointment.time}</span>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-3 sm:justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="border-gray-600 text-white hover:border-blue-400 hover:bg-gray-800 transition-all duration-200"
              >
                Keep appointment
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirmCancel}
              className="bg-red-600 text-white border border-transparent hover:border-blue-400 hover:bg-red-500"
              disabled={loadingCancel}
            >
              {loadingCancel ? 'Cancelling…' : 'Yes, cancel it'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
