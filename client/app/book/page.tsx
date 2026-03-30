// dopecut/dopekuts-main/app/book/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { isValidPhoneNumber, E164Number } from 'libphonenumber-js';
import { Scissors, Calendar, X, Clock, User, CreditCard, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import moment from 'moment-timezone';
import toast from 'react-hot-toast';

// --- API Imports ---
import { getAllServices, IService } from '@/lib/api/service';
import {
  getCalendarSettings,
  getWeeklyCalendar,
  getCalendarTimezone,
  getAvailability,
  ICalendarSettings,
  IWeeklyCalendar,
} from '@/lib/api/calendar';
import { getCalendarWeeks } from '@/lib/api/notifications';
import {
  createBooking,
  IBooking,
  CreateBookingData,
  joinBookingQueue,
  QueueJoinPayload,
} from '@/lib/api/booking';
import { getContactByPhone, IContactLookup } from '@/lib/api/contact';

// --- Helper Types ---
interface AvailableDate {
  date: string;     // "YYYY-MM-DD"
  display: string;  // "MMM DD"
  dayName: string;  // "ddd"
  isToday: boolean;
  isTomorrow: boolean;
  isDisabled?: boolean;
}

interface GuestEntry {
  firstName: string;
  lastName: string;
  email?: string;
  serviceId: string;
  time: string;
}

function findWeeklyDay(
  date: string,
  weeks: IWeeklyCalendar[],
  timezone?: string
): IWeeklyCalendar['days'][0] | null {
  const zone = timezone && moment.tz.zone(timezone) ? timezone : undefined;
  const m = zone ? moment.tz(date, 'YYYY-MM-DD', zone) : moment(date, 'YYYY-MM-DD');
  const weekStart = m.clone().startOf('isoWeek').format('YYYY-MM-DD');
  const week = weeks.find((w) => w.weekStart === weekStart);
  if (!week) return null;
  const dayOfWeek = m.format('dddd') as IWeeklyCalendar['days'][0]['dayOfWeek'];
  return week.days.find((d) => d.dayOfWeek === dayOfWeek) ?? null;
}

/** Compress slots to the service’s cadence when it divides the day’s slot step cleanly */
function compressSlotsForService(slots: string[], serviceMin: number, slotStepMin: number): string[] {
  if (!serviceMin || !slotStepMin) return slots;
  if (serviceMin % slotStepMin !== 0) return slots; // don’t guess for non-multiples like 45 vs 30
  const takeEvery = Math.max(1, Math.floor(serviceMin / slotStepMin));
  if (takeEvery <= 1) return slots;
  return slots.filter((_, i) => i % takeEvery === 0);
}

const ADAPTIVE_SERVICE_RULES: Array<{ keywords: string[]; duration: number }> = [
  { keywords: ['kids cut', 'kid cut'], duration: 20 },
  { keywords: ['hair line up', 'hair line-up', 'hair lineup', 'lineup'], duration: 20 },
  { keywords: ['beard trim'], duration: 20 },
  { keywords: ['deluxe'], duration: 60 },
];

const TORONTO_TIMEZONE = 'America/Toronto';

function getAdaptiveDuration(service?: IService): number {
  if (!service) return 0;
  const normalized = (service.name || '').toLowerCase();
  const rule = ADAPTIVE_SERVICE_RULES.find((r) =>
    r.keywords.some((keyword) => normalized.includes(keyword))
  );
  // Default services should be at least one 40-minute slot.
  if (rule) return rule.duration;
  return Math.max(service.duration, 40);
}

/** Find the slotDuration for the selected date from calendar settings */
function getSlotDurationForDate(settings: ICalendarSettings[], date: string, timezone?: string): number {
  const zone = timezone && moment.tz.zone(timezone) ? timezone : undefined;
  const dow = zone
    ? moment.tz(date, 'YYYY-MM-DD', zone).format('dddd')
    : moment(date, 'YYYY-MM-DD').format('dddd');
  const s = settings.find(x => x.dayOfWeek === dow);
  return s?.slotDuration ?? 40;
}

export default function BookAppointment() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // --- Data from API ---
  const [services, setServices] = useState<IService[]>([]);
  const [calendarSettings, setCalendarSettings] = useState<ICalendarSettings[]>([]);
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [weeklySchedules, setWeeklySchedules] = useState<IWeeklyCalendar[]>([]);
  const [weeksToShow, setWeeksToShow] = useState(4);
  const [currentWeekIdx, setCurrentWeekIdx] = useState(0);
  const [businessTimezone, setBusinessTimezone] = useState<string>(TORONTO_TIMEZONE);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  // --- Form & UI State ---
  const [formData, setFormData] = useState({
    serviceId: '',
    date: '',
    time: '',
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
    notes: '',
    paymentMethod: 'in-person' as 'in-person' | 'now',
  });
  const [showRestOfForm, setShowRestOfForm] = useState(false);
  const [guestEntries, setGuestEntries] = useState<GuestEntry[]>([]);
  const [cancellationCount, setCancellationCount] = useState(0);
  const [queueRequestedDate, setQueueRequestedDate] = useState<string | null>(null);
  const [queueJoined, setQueueJoined] = useState(false);
  const [isJoiningQueue, setIsJoiningQueue] = useState(false);
  const [queuePreferredTime, setQueuePreferredTime] = useState('');
  const [queuePreferAnytime, setQueuePreferAnytime] = useState(true);
  const [queueConfirmation, setQueueConfirmation] = useState<{ date: string; preferAnytime: boolean; desiredTime?: string } | null>(null);
  // --- Per-guest time slots (adapts to each guest's selected service) ---
  const [guestTimeSlots, setGuestTimeSlots] = useState<Record<number, string[]>>({});
  const [guestSlotsLoading, setGuestSlotsLoading] = useState<Record<number, boolean>>({});
  const weekBuckets = useMemo(() => {
    const buckets: AvailableDate[][] = [];
    availableDates.forEach((date) => {
      const weekStart = moment(date.date).startOf('isoWeek').format('YYYY-MM-DD');
      const idx = buckets.findIndex((bucket) => bucket.length && moment(bucket[0].date).startOf('isoWeek').format('YYYY-MM-DD') === weekStart);
      if (idx >= 0) {
        buckets[idx].push(date);
      } else {
        buckets.push([date]);
      }
    });
    return buckets;
  }, [availableDates]);

  useEffect(() => {
    if (currentWeekIdx >= weekBuckets.length) {
      setCurrentWeekIdx(Math.max(0, weekBuckets.length - 1));
    }
  }, [weekBuckets.length, currentWeekIdx]);

  const usedTimesList = useMemo(() => {
    const list = guestEntries.map((guest) => guest.time).filter(Boolean);
    if (formData.time) {
      list.push(formData.time);
    }
    return Array.from(new Set(list));
  }, [guestEntries, formData.time]);

  const usedTimesSet = useMemo(() => new Set(usedTimesList), [usedTimesList]);

  const resolvedTimezone = useMemo(() => {
    if (businessTimezone && moment.tz.zone(businessTimezone)) return businessTimezone;
    if (moment.tz.zone(TORONTO_TIMEZONE)) return TORONTO_TIMEZONE;
    return moment.tz.guess();
  }, [businessTimezone]);

  const formatDateInTimezone = useCallback(
    (dateStr: string, fmt: string) =>
      dateStr ? moment.tz(dateStr, 'YYYY-MM-DD', resolvedTimezone).format(fmt) : '',
    [resolvedTimezone]
  );

  const formatBookingDateForDisplay = useCallback(
    (dateInput?: string | Date | null) => {
      if (!dateInput) return '';
      const iso = moment.utc(dateInput).format('YYYY-MM-DD');
      return formatDateInTimezone(iso, 'MMMM DD, YYYY');
    },
    [formatDateInTimezone]
  );

  const remainingSlotsForNewGuest = useMemo(
    () => timeSlots.filter((slot) => !usedTimesSet.has(slot)),
    [timeSlots, usedTimesSet]
  );

  const maxAdditionalGuests = useMemo(
    () => Math.max(0, Math.min(remainingSlotsForNewGuest.length, 8)),
    [remainingSlotsForNewGuest.length]
  );

  useEffect(() => {
    if (guestEntries.length > maxAdditionalGuests) {
      setGuestEntries((prev) => prev.slice(0, maxAdditionalGuests));
    }
  }, [guestEntries.length, maxAdditionalGuests]);

  const canAddGuest = Boolean(formData.date) && remainingSlotsForNewGuest.length > 0;
  const mainTimeOptions = useMemo(
    () => timeSlots.filter((slot) => !usedTimesSet.has(slot) || slot === formData.time),
    [timeSlots, usedTimesSet, formData.time]
  );

  const timeOptionsForGuest = (guestIndex: number, currentTime?: string) => {
    const guestSlots = guestTimeSlots[guestIndex] || timeSlots;
    return guestSlots.filter((slot) => !usedTimesSet.has(slot) || slot === currentTime);
  };

  const currentWeekDates = weekBuckets[currentWeekIdx] || [];
  const currentWeekLabel = currentWeekDates.length
    ? `${moment(currentWeekDates[0].date).format('MMM D')} – ${moment(currentWeekDates[currentWeekDates.length - 1].date).format('MMM D')}`
    : 'Current Week';

  useEffect(() => {
    if (!canAddGuest && guestEntries.length > 0) {
      setGuestEntries([]);
      toast('Only one slot remains for the selected day; extra bookings were removed.');
    }
  }, [canAddGuest, guestEntries.length]);

  const fetchSlotsForService = async ({
    targetDate,
    serviceId,
    setSlots,
    setLoading,
    resetTime,
    setAlt,
    errorMessage,
  }: {
    targetDate: string;
    serviceId: string;
    setSlots: React.Dispatch<React.SetStateAction<string[]>>;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    resetTime?: () => void;
    setAlt?: React.Dispatch<React.SetStateAction<string[]>>;
    errorMessage?: string;
  }) => {
    try {
      setLoading(true);
      setAlt?.([]);
      resetTime?.();

      const rawSlots = await getAvailability(targetDate, { serviceId });
      const selectedService = services.find((svc) => svc._id === serviceId);
      const slotStep = getSlotDurationForDate(calendarSettings, targetDate, resolvedTimezone);
      const compressedSlots = compressSlotsForService(
        rawSlots,
        getAdaptiveDuration(selectedService),
        slotStep
      );
      setSlots(compressedSlots);
    } catch (error) {
      toast.error(
        errorMessage ||
          `Failed to get available times for ${moment(targetDate).format('MMMM D')}.`
      );
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Suggestions when backend rejects slot (HTTP 409) ---
  const [altSuggestions, setAltSuggestions] = useState<string[]>([]);

  // --- Confirmation State ---
  const [confirmedBooking, setConfirmedBooking] = useState<IBooking | null>(null);
  const [confirmedAdditionalBookings, setConfirmedAdditionalBookings] = useState<IBooking[]>([]);

  const resolveServicePrice = useCallback(
    (serviceId?: string, serviceName?: string) => {
      const byId = serviceId ? services.find((s) => s._id === serviceId) : undefined;
      if (byId) return byId.price || 0;
      const byName = serviceName ? services.find((s) => s.name === serviceName) : undefined;
      return byName?.price || 0;
    },
    [services]
  );

  const primaryPrice = useMemo(() => {
    if (!formData.serviceId) return 0;
    return resolveServicePrice(formData.serviceId);
  }, [formData.serviceId, resolveServicePrice]);

  const additionalBookingsTotal = useMemo(() => {
    if (!guestEntries || guestEntries.length === 0) return 0;
    return guestEntries.reduce((sum, guest) => {
      if (!guest.serviceId) return sum;
      return sum + resolveServicePrice(guest.serviceId);
    }, 0);
  }, [guestEntries, resolveServicePrice]);

  const bookingTotal = useMemo(
    () => primaryPrice + additionalBookingsTotal,
    [primaryPrice, additionalBookingsTotal]
  );

  // --- Initial Data Fetching ---
  useEffect(() => {
    const serviceIdFromUrl = searchParams.get('serviceId');
    if (serviceIdFromUrl) {
      setFormData(prev => ({ ...prev, serviceId: serviceIdFromUrl }));
    }

    const fetchInitialData = async () => {
      try {
        setIsLoadingServices(true);
        const [servicesResponse, settingsResponse, weeksSetting, timezoneResponse] = await Promise.all([
          getAllServices(),
          getCalendarSettings(),
          getCalendarWeeks().catch(() => ({ weeks: 4 })),
          getCalendarTimezone().catch(() => ({ timezone: moment.tz.guess() })),
        ]);
        const weeksValue = Math.min(12, Math.max(1, weeksSetting?.weeks || 4));
        setWeeksToShow(weeksValue);
        const weeklyData = await getWeeklyCalendar(weeksValue);
        const tzValue =
          timezoneResponse?.timezone && moment.tz.zone(timezoneResponse.timezone)
            ? timezoneResponse.timezone
            : moment.tz.guess();
        setBusinessTimezone(tzValue);
        setServices(servicesResponse);
        setCalendarSettings(settingsResponse); // store settings so we can read slotDuration for the chosen date
        setWeeklySchedules(weeklyData);
        generateAvailableDates(settingsResponse, weeklyData, tzValue, weeksValue);
      } catch (error) {
        toast.error('Failed to load initial booking data. Please try again.');
        console.error('Error fetching initial data:', error);
      } finally {
        setIsLoadingServices(false);
      }
    };
    fetchInitialData();
  }, [searchParams]);

  useEffect(() => {
    if (calendarSettings.length > 0 && weeklySchedules.length > 0) {
      generateAvailableDates(calendarSettings, weeklySchedules, resolvedTimezone, weeksToShow);
    }
  }, [calendarSettings, weeklySchedules, resolvedTimezone, weeksToShow]);

  // --- Refetch availability when date or service changes (service-aware) ---
  useEffect(() => {
    if (!formData.date || !formData.serviceId) return;

    fetchSlotsForService({
      targetDate: formData.date,
      serviceId: formData.serviceId,
      setSlots: setTimeSlots,
      setLoading: setIsLoadingAvailability,
      setAlt: setAltSuggestions,
      resetTime: () => setFormData((prev) => ({ ...prev, time: '' })),
      errorMessage: `Failed to load slots for ${formatDateInTimezone(formData.date, 'MMMM D')}.`,
    });
    // include calendarSettings & services so compression stays in sync
  }, [formData.date, formData.serviceId, calendarSettings, services]);

  // --- If user changes service after picking a time, clear time ---
  useEffect(() => {
    if (!formData.serviceId) return;
    if (formData.time) {
      setFormData(prev => ({ ...prev, time: '' }));
    }
  }, [formData.serviceId]);

  useEffect(() => {
    setQueueRequestedDate(null);
    setQueueJoined(false);
    setIsJoiningQueue(false);
    setGuestEntries([]);
    setGuestTimeSlots({});
    setGuestSlotsLoading({});
  }, [formData.date, formData.serviceId]);

  // --- Scroll to top whenever step changes ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  const needsPrepay = cancellationCount >= 3;
  const isQueueFlow = Boolean(queueRequestedDate);
  const payAtAppointmentAllowed = !needsPrepay || isQueueFlow;

  useEffect(() => {
    if (needsPrepay && formData.paymentMethod !== 'now') {
      setFormData((prev) => ({ ...prev, paymentMethod: 'now' }));
    }
  }, [needsPrepay, formData.paymentMethod]);

  // --- Helper Functions ---
  const generateAvailableDates = (
    settings: ICalendarSettings[],
    weekly: IWeeklyCalendar[],
    timezone: string | undefined,
    weeksRange: number
  ) => {
    const zone = timezone && moment.tz.zone(timezone) ? timezone : moment.tz.guess();
    const enabledDays = settings
      .filter(day => day.isEnabled)
      .map(day => day.dayOfWeek);

    const dayNameToIndex: { [key: string]: number } = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    const enabledDayIndexes = enabledDays.map(dayName => dayNameToIndex[dayName]);

    const dates: AvailableDate[] = [];
    const today = moment.tz(zone);
    const tomorrow = today.clone().add(1, 'day');
    const maxDays = Math.max(7, Math.min(weeksRange * 7, 84)); // clamp to 12 weeks max

    for (let i = 0; i < maxDays; i++) {
      const date = today.clone().add(i, 'days');
      const weeklyDay = findWeeklyDay(date.format('YYYY-MM-DD'), weekly, zone);
      if (weeklyDay && !weeklyDay.isEnabled) continue;
      if (enabledDayIndexes.includes(date.day())) {
        dates.push({
          date: date.format('YYYY-MM-DD'),
          display: date.format('MMM DD'),
          dayName: date.format('ddd'),
          isToday: date.isSame(today, 'day'),
          isTomorrow: date.isSame(tomorrow, 'day'),
          isDisabled: weeklyDay ? !weeklyDay.isEnabled : false,
        });
      }
    }
    setAvailableDates(dates);
    setCurrentWeekIdx(0);
  };

  // --- Event Handlers ---
  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handlePhoneSubmit = async () => {
    if (formData.phone && isValidPhoneNumber(formData.phone)) {
      setShowRestOfForm(true);

      // Autofill via public contact lookup (new endpoint)
      try {
      const contact: IContactLookup = await getContactByPhone(formData.phone);
      // Split full name into first/last best-effort
      const [first, ...rest] = (contact.name || '').trim().split(/\s+/);
      const last = rest.join(' ');
      setFormData(prev => ({
        ...prev,
        firstName: first || prev.firstName,
        lastName: last || prev.lastName,
        email: contact.email || prev.email,
      }));
      setCancellationCount(contact.cancellationCount ?? 0);
      } catch {
        // No contact found or lookup failed -> keep fields empty
        setCancellationCount(0);
      }
    }
  };

  const handleQueueRequest = () => {
    if (!formData.serviceId || !formData.date) {
      toast.error('Please select a service and date before joining the queue.');
      return;
    }
    setQueueRequestedDate(formData.date);
    setQueueJoined(false);
    setGuestEntries([]);
    setQueueConfirmation(null);
    setStep(3);
    toast('Go to the contact step to finalize your queue request.');
  };

  const buildGuestTemplate = () => ({
    firstName: '',
    lastName: '',
    email: '',
    serviceId: formData.serviceId || '',
    time: '',
  });

  const updateGuestCount = (count: number) => {
    if (!canAddGuest && count > 0) return;
    setGuestEntries((prev) => {
      const safeCount = Math.max(0, count);
      return Array.from({ length: safeCount }, (_, idx) => prev[idx] ?? buildGuestTemplate());
    });
  };

  // Fetch time slots for a specific guest based on their selected service
  const fetchGuestSlots = async (guestIndex: number, serviceId: string) => {
    if (!formData.date || !serviceId) return;
    
    setGuestSlotsLoading(prev => ({ ...prev, [guestIndex]: true }));
    try {
      const rawSlots = await getAvailability(formData.date, { serviceId });
      const selectedService = services.find(svc => svc._id === serviceId);
      const slotStep = getSlotDurationForDate(calendarSettings, formData.date, resolvedTimezone);
      const compressedSlots = compressSlotsForService(
        rawSlots,
        getAdaptiveDuration(selectedService),
        slotStep
      );
      setGuestTimeSlots(prev => ({ ...prev, [guestIndex]: compressedSlots }));
    } catch (error) {
      console.error('Error fetching guest slots:', error);
      // Fall back to main timeSlots
      setGuestTimeSlots(prev => ({ ...prev, [guestIndex]: timeSlots }));
    } finally {
      setGuestSlotsLoading(prev => ({ ...prev, [guestIndex]: false }));
    }
  };

  const updateGuestEntry = (index: number, data: Partial<GuestEntry>) => {
    setGuestEntries((prev) =>
      prev.map((entry, idx) => {
        if (idx !== index) return entry;
        // If serviceId changed, clear time selection and fetch new slots
        if (data.serviceId && data.serviceId !== entry.serviceId) {
          fetchGuestSlots(index, data.serviceId);
          return { ...entry, ...data, time: '' };
        }
        return { ...entry, ...data };
      })
    );
  };

  const removeGuestEntry = (index: number) => {
    setGuestEntries((prev) => prev.filter((_, idx) => idx !== index));
    // Clean up guest-specific slots state
    setGuestTimeSlots(prev => {
      const newSlots = { ...prev };
      delete newSlots[index];
      return newSlots;
    });
    setGuestSlotsLoading(prev => {
      const newLoading = { ...prev };
      delete newLoading[index];
      return newLoading;
    });
  };

  const buildAdditionalGuests = () => {
    return guestEntries
      .filter(
        (guest) =>
          guest.firstName &&
          guest.serviceId &&
          guest.time
      )
      .map((guest) => ({
        firstName: guest.firstName,
        lastName: guest.lastName || '',
        email: guest.email || undefined,
        serviceId: guest.serviceId,
        time: guest.time,
      }));
  };

  const handleJoinQueue = async () => {
    if (!queueRequestedDate) return;
    if (!formData.serviceId) {
      toast.error('Select a service before joining the queue.');
      return;
    }
    if (!formData.firstName) {
      toast.error('Please provide your name before joining the queue.');
      setStep(3);
      return;
    }
    if (!isValidPhoneNumber(formData.phone)) {
      toast.error('Please provide a valid phone number to join the queue.');
      setStep(3);
      return;
    }
    if (!queuePreferAnytime && !queuePreferredTime) {
      toast.error('Select a preferred time or choose Anytime.');
      return;
    }

    const guestPayload = buildAdditionalGuests();

    const payload: QueueJoinPayload = {
      firstName: formData.firstName,
      lastName: formData.lastName || undefined,
      email: formData.email,
      phone: formData.phone,
      serviceId: formData.serviceId,
      requestedDate: queueRequestedDate,
      desiredTime: queuePreferAnytime ? undefined : queuePreferredTime || undefined,
      preferAnytime: queuePreferAnytime,
      preferredPaymentMethod: 'in-person',
      notes: formData.notes,
      additionalGuests: guestPayload,
    };

    try {
      setIsJoiningQueue(true);
      await joinBookingQueue(payload);
      toast.success('You are now in the queue for that day. We will text you if a slot opens.');
      setQueueJoined(true);
      setQueueConfirmation({
        date: queueRequestedDate,
        preferAnytime: queuePreferAnytime,
        desiredTime: queuePreferAnytime ? undefined : queuePreferredTime,
      });
      setStep(5);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        (error as Error)?.message ||
        'Failed to join the queue.';
      toast.error(message);
    } finally {
      setIsJoiningQueue(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    toast.loading('Submitting your booking...');

    const additionalGuests = buildAdditionalGuests();
    const payload: CreateBookingData = {
      serviceId: formData.serviceId,
      date: formData.date,
      time: formData.time,
      phone: formData.phone as E164Number,
      firstName: formData.firstName,
      lastName: formData.lastName || '',
      email: formData.email,
      notes: formData.notes,
      paymentMethod: formData.paymentMethod,
      additionalGuests: additionalGuests.length > 0 ? additionalGuests : undefined,
    };

    try {
      const result = await createBooking(payload);
      setConfirmedBooking(result.booking);
      setConfirmedAdditionalBookings(result.additionalBookings || []);
      toast.dismiss();
      toast.success(result.message);
    } catch (error: any) {
      toast.dismiss();
      if (error?.status === 409) {
        const msg = (error as Error)?.message || 'Selected time is unavailable.';
        toast.error(msg);

        const selectedService = services.find((s) => s._id === formData.serviceId);
        const slotStep = getSlotDurationForDate(calendarSettings, formData.date, resolvedTimezone);
        const compressed = compressSlotsForService(
          error?.suggestions || [],
          getAdaptiveDuration(selectedService),
          slotStep
        );

        setAltSuggestions(compressed);
        setStep(2); // return user to time selection
      } else {
        const errorMessage =
          error?.response?.data?.message ||
          (error as Error)?.message ||
          'Failed to create booking.';
        toast.error(errorMessage);
      }
      console.error('Booking submission error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookingComplete = () => {
    setStep(1);
    setConfirmedBooking(null);
    setFormData({
      serviceId: '',
      date: '',
      time: '',
      phone: '',
      firstName: '',
      lastName: '',
      email: '',
      notes: '',
      paymentMethod: 'in-person',
    });
    setAltSuggestions([]);
    setShowRestOfForm(false);
    setGuestEntries([]);
    setConfirmedAdditionalBookings([]);
    setQueueRequestedDate(null);
    setQueueJoined(false);
    setIsJoiningQueue(false);
    setQueuePreferredTime('');
    setQueuePreferAnytime(true);
    setQueueConfirmation(null);
    router.push('/services');
  };

  const selectedService = services.find((s) => s._id === formData.serviceId);
  const selectedServiceDuration = getAdaptiveDuration(selectedService);

  const queueTimeOptions = useMemo(() => {
    return mainTimeOptions.length > 0 ? mainTimeOptions : [];
  }, [mainTimeOptions]);

  useEffect(() => {
    if (!queuePreferAnytime && queueTimeOptions.length > 0 && !queuePreferredTime) {
      setQueuePreferredTime(queueTimeOptions[0]);
    }
  }, [queuePreferAnytime, queuePreferredTime, queueTimeOptions]);

  // --- Confirmation Screen ---
  if (confirmedBooking) {
    const isPending = confirmedBooking.status === 'pending';
    const additionalBookingTotal =
      confirmedAdditionalBookings.length > 0
        ? confirmedAdditionalBookings.reduce((sum, b) => sum + (b.price || 0), 0)
        : (confirmedBooking.additionalGuests || []).reduce(
            (sum, guest) => sum + resolveServicePrice(guest.serviceId as string, guest.serviceName),
            0
          );
    const primaryPrice =
      confirmedBooking.price ||
      resolveServicePrice(confirmedBooking.serviceId as string, confirmedBooking.service);
    const totalPrice = primaryPrice + additionalBookingTotal;
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="container-max section-padding py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 lg:p-12">
              <div className="mb-8">
                <div className={`w-20 h-20 ${isPending ? 'bg-yellow-500' : 'bg-green-500'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                  {isPending ? (
                    <Clock className="w-10 h-10 text-white" />
                  ) : (
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                  {isPending ? 'Booking Pending' : 'Booking Confirmed!'}
                </h1>
                <p className="text-lg text-gray-300 mb-8">
                  {isPending
                    ? 'Your appointment is reserved! Please complete the payment to confirm.'
                    : 'On your appointment date please allow 10mins wait time'}
                </p>
              </div>

              {isPending && (
                <div className="bg-gray-700 p-6 rounded-lg border border-gray-600 mb-8 text-left">
                  <h3 className="text-lg font-bold text-white mb-4">Complete Your Payment</h3>
                  <p className="text-gray-300 mb-4">To confirm your booking, please send an Interac e-Transfer with the following details:</p>
                  <div className="space-y-2 text-sm">
                    <p><strong className="text-gray-200">Recipient Email: leeroyfoghoosiobe@gmail.com </strong ></p>
                    <p><strong className="text-gray-200">Amount: ${totalPrice} </strong></p>
                    <p><strong className="text-gray-200">Message/Note:Booking for {confirmedBooking.firstName} </strong> </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">Your booking will be automatically confirmed once payment is received.</p>
                </div>
              )}

              <div className="bg-gray-700 p-6 rounded-lg border border-gray-600 mb-8">
                <h3 className="text-lg font-bold text-white mb-4">Appointment Details</h3>
                <div className="space-y-3 text-left">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Service:</span>
                    <span className="text-white font-medium">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Date:</span>
                    <span className="text-white font-medium">
                      {formatBookingDateForDisplay(confirmedBooking.date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Time:</span>
                    <span className="text-white font-medium">{confirmedBooking.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Customer:</span>
                    <span className="text-white font-medium">{confirmedBooking.firstName} {confirmedBooking.lastName}</span>
                  </div>
                  {confirmedBooking.additionalGuests && confirmedBooking.additionalGuests.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Additional Booking(s):</span>
                      <span className="text-white font-medium">
                        {confirmedBooking.additionalGuests.map((guest) => `${guest.firstName} ${guest.lastName}`).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-600 pt-3">
                    <span className="text-gray-300">Total:</span>
                    <span className="text-white font-bold text-lg">${totalPrice}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={handleBookingComplete}
                  className="w-full bg-white text-black hover:bg-gray-200 py-3"
                >
                  Book Another Appointment
                </Button>
                <p className="text-sm text-gray-400">
                  You will receive an email confirmation within the next few minutes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (queueConfirmation) {
    const qc = queueConfirmation!;
    const queueService = services.find((s) => s._id === formData.serviceId) || selectedService;
    const queueDuration = queueService ? getAdaptiveDuration(queueService) : 0;
    const queuePrice = queueService ? queueService.price : resolveServicePrice(formData.serviceId);
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="container-max section-padding py-12">
          <div className="max-w-xl mx-auto text-center bg-gray-800 border border-gray-700 rounded-lg p-8 lg:p-12">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">You’re on the Queue</h1>
            <p className="text-gray-300 mb-6">
              We’ll text you at {formData.phone} if a slot opens on{' '}
              {moment(qc.date).format('MMMM D')}.
            </p>
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-left text-sm text-gray-200 space-y-2 mb-6">
              <div className="flex justify-between">
                <span>Preferred time</span>
                <span>{qc.preferAnytime ? 'Anytime that day' : qc.desiredTime || 'Not set'}</span>
              </div>
              {queueService && (
                <>
                  <div className="flex justify-between">
                    <span>Service</span>
                    <span>{queueService.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span>{queueDuration || queueService.duration} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price</span>
                    <span>${queuePrice}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="capitalize">Set at assignment</span>
              </div>
            </div>
            <div className="space-y-3">
              <Button onClick={() => router.push('/services')} className="w-full bg-white text-black hover:bg-gray-200">
                Back to services
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Booking Form ---
  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {/* Local override for the phone number input ONLY */}
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
          box-shadow: 0 0 0 2px rgba(255,255,255,0.12) !important;
        }
      `}</style>

      {/* Header Section */}
      <div className="bg-black border-b border-gray-800">
        <div className="container-max section-padding py-12 lg:py-16">
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Book Your Appointment
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              Schedule your visit with our master barbers in just a few simple steps
            </p>
          </div>
        </div>
      </div>

      <div className="container-max section-padding py-8 lg:py-12">
        <div className="w-full">
          {/* Progress Indicator */}
          <div className="flex justify-center mb-8 lg:mb-12">
            <div className="flex items-center space-x-4">
              {[1, 2, 3, 4].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <div
                    className={`w-8 h-8 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold transition-all duration-300 ${
                      step >= stepNumber
                        ? 'bg-white text-black shadow-lg'
                        : 'bg-gray-700 text-gray-400 border-2 border-gray-600'
                    }`}
                  >
                    {stepNumber}
                  </div>
                  {stepNumber < 4 && (
                    <div
                      className={`w-8 lg:w-16 h-1 transition-all duration-300 ${
                        step > stepNumber ? 'bg-white' : 'bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
            {/* Main Content */}
            <div className="xl:col-span-2 order-2 xl:order-1">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white text-xl lg:text-2xl">
                    {step === 1 && <><Scissors className="h-6 w-6" /> Select Service</>}
                    {step === 2 && <><Calendar className="h-6 w-6" /> Choose Date & Time</>}
                    {step === 3 && <><User className="h-6 w-6" /> Your Information</>}
                    {step === 4 && <><CreditCard className="h-6 w-6" /> Confirmation</>}
                  </CardTitle>
                  <CardDescription className="text-gray-300 text-base lg:text-lg">
                    {step === 1 && 'Choose the service you would like to book'}
                    {step === 2 && 'Select your preferred date and time'}
                    {step === 3 && 'Please provide your contact information'}
                    {step === 4 && 'Review and confirm your booking'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 lg:space-y-8">
                  {/* Step 1: Service Selection */}
                  {step === 1 && (
                    isLoadingServices ? (
                      <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <RadioGroup
                          value={formData.serviceId}
                          onValueChange={(value) => setFormData({ ...formData, serviceId: value })}
                        >
                          {services.map((service) => {
                            const displayDuration = getAdaptiveDuration(service);
                            return (
                            <div
                              key={service._id}
                              className={`relative p-4 lg:p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:bg-gray-700 ${
                                formData.serviceId === service._id
                                  ? 'border-white bg-gray-700'
                                  : 'border-gray-600 bg-gray-800'
                              }`}
                              onClick={() => setFormData({ ...formData, serviceId: service._id })}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setFormData({ ...formData, serviceId: service._id });
                                }
                              }}
                            >
                              <Label htmlFor={service._id} className="cursor-pointer block">
                                <div className="flex justify-between items-start mb-3">
                                  {/* Left info */}
                                  <div className="pr-4">
                                    <h3 className="text-lg lg:text-xl font-bold text-white mb-2">{service.name}</h3>
                                    <p className="text-sm lg:text-base text-gray-300 mb-2">
                                      Duration: {displayDuration} minutes
                                    </p>
                                  </div>

                                  {/* Right column: radio on top, price below */}
                                  <div className="flex flex-col items-end gap-2">
                                    <RadioGroupItem
                                      value={service._id}
                                      id={service._id}
                                    />
                                    <div className="text-right">
                                      <div className="text-xl lg:text-2xl font-bold text-white">${service.price}</div>
                                    </div>
                                  </div>
                                </div>

                                {service.description && (
                                  <p className="text-sm text-gray-400 pr-0">{service.description}</p>
                                )}
                              </Label>
                            </div>
                            );
                          })}
                        </RadioGroup>
                      </div>
                    )
                  )}

                  {/* Step 2: Date & Time Selection */}
                      {step === 2 && (
                        <div className="space-y-6 lg:space-y-8">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="bg-white text-blue-600 border border-white shadow-sm hover:bg-gray-100 hover:border-gray-200 disabled:opacity-40 disabled:bg-gray-200 disabled:text-blue-400"
                                onClick={() => setCurrentWeekIdx((idx) => Math.max(0, idx - 1))}
                                disabled={currentWeekIdx === 0}
                              >
                                <ChevronLeft className="h-5 w-5 text-blue-600" />
                              </Button>
                              <Label className="text-white text-base lg:text-lg font-semibold text-center">
                                {currentWeekLabel}
                              </Label>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="bg-white text-blue-600 border border-white shadow-sm hover:bg-gray-100 hover:border-gray-200 disabled:opacity-40 disabled:bg-gray-200 disabled:text-blue-400"
                                onClick={() =>
                                  setCurrentWeekIdx((idx) =>
                                    Math.min(weekBuckets.length - 1, idx + 1)
                                  )
                                }
                                disabled={currentWeekIdx >= weekBuckets.length - 1}
                              >
                                <ChevronRight className="h-5 w-5 text-blue-600" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                              {currentWeekDates.map((dateObj) => (
                                <button
                                  key={dateObj.date}
                                  onClick={() => setFormData({ ...formData, date: dateObj.date })}
                                  className={`p-3 lg:p-4 rounded-lg border-2 transition-all duration-300 text-center ${
                                    formData.date === dateObj.date
                                      ? 'border-white bg-white text-black'
                                      : 'border-gray-600 bg-gray-700 text-white hover:border-gray-400'
                                  }`}
                                >
                                  <div className="text-xs lg:text-sm font-medium">{dateObj.dayName}</div>
                                  <div className="text-sm lg:text-lg font-bold">{dateObj.display}</div>
                                  {dateObj.isToday && <div className="text-xs text-gray-400 mt-1">Today</div>}
                                  {dateObj.isTomorrow && <div className="text-xs text-gray-400 mt-1">Tomorrow</div>}
                                </button>
                              ))}
                              {currentWeekDates.length === 0 && (
                                <div className="col-span-full text-center text-gray-400 text-sm">
                                  No available dates in this week.
                                </div>
                              )}
                            </div>
                          </div>

                      {formData.date && (
                        isLoadingAvailability ? (
                          <div className="flex justify-center items-center h-32">
                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Label className="text-white text-base lg:text-lg font-semibold mb-4 block">Select Time</Label>
                            <p className="text-xs text-gray-400 mt-0 mb-3">
                              Time slots are spaced 40 minutes apart. Kids Cut, Hair Line Up, and Beard Trim use 20-minute half-slots—try those if you need a shorter opening.
                            </p>
                            {timeSlots.length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {mainTimeOptions.map((time) => (
                                  <button
                                    key={time}
                                    onClick={() => {
                                      setFormData({ ...formData, time });
                                      setAltSuggestions([]);
                                    }}
                                    className={`p-2 lg:p-3 rounded-lg border-2 transition-all duration-300 text-center font-medium text-sm lg:text-base ${
                                      formData.time === time
                                        ? 'border-white bg-white text-black'
                                        : 'border-gray-600 bg-gray-700 text-white hover:border-gray-400'
                                    }`}
                                  >
                                    {time}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center text-gray-400 bg-gray-700 p-6 rounded-lg space-y-3">
                                <p className="text-base font-semibold text-white">
                                  No available slots for this day.
                                </p>
                                <p className="text-sm text-gray-300">
                                  If you still want this date we can queue you for the first cancellation.
                                </p>
                                <p className="text-sm text-gray-300">
                                  Tip: shorter services (Kids Cut, Hair Line Up, Beard Trim) use 20-minute half-slots and may open up sooner.
                                </p>
                                <p className="text-xs text-gray-400">
                                  We will text you if someone cancels a slot on that day.
                                </p>
                              </div>
                            )}

                            {altSuggestions.length > 0 && (
                              <div className="mt-6">
                                <h4 className="text-white font-semibold mb-3">Suggested Alternatives</h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                  {altSuggestions.map((time) => (
                                    <button
                                      key={`sugg-${time}`}
                                      onClick={() => {
                                        setFormData({ ...formData, time });
                                        setAltSuggestions([]);
                                        toast.success(`Selected ${time}`);
                                      }}
                                      className="p-2 lg:p-3 rounded-lg border-2 transition-all duration-300 text-center font-medium text-sm lg:text-base border-blue-400 bg-blue-900/30 text-white hover:bg-blue-900/50"
                                    >
                                      {time}
                                    </button>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-400 mt-2">These times fit your selected service length and the shop schedule.</p>
                              </div>
                            )}

                            <p className="text-sm text-gray-300">
                              Don&apos;t see your preferred time? Join the Queue, or try a 20-minute service (Kids Cut, Hair Line Up, Beard Trim) if you just need a quick slot.
                            </p>
                            <div className="mt-6">
                              <Button
                                onClick={handleQueueRequest}
                                className="w-full bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
                                disabled={!formData.serviceId}
                              >
                                Join the queue for {formData.date ? moment(formData.date).format('MMMM D') : 'selected day'}
                              </Button>
                              <p className="text-xs text-gray-400 mt-1">
                                We will text you if someone cancels a slot for this day
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Step 3: Customer Information */}
                  {step === 3 && (
                    <div className="space-y-8">
                      <div>
                        <Label htmlFor="phone" className="text-white font-medium text-lg">Phone Number</Label>
                        <p className="text-gray-400 text-sm mt-1 mb-4">Please enter your phone number to continue</p>
                        <div className="space-y-4">
                          <PhoneInput
                            international
                            defaultCountry="CA"
                            value={formData.phone}
                            onChange={(value) => setFormData({ ...formData, phone: value || '' })}
                            className="phone-input"
                          />
                          {formData.phone && !isValidPhoneNumber(formData.phone) && (
                            <p className="text-red-400 text-sm">Please enter a valid phone number</p>
                          )}
                          {formData.phone && isValidPhoneNumber(formData.phone) && !showRestOfForm && (
                            <Button
                              onClick={handlePhoneSubmit}
                              className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
                            >
                              Continue
                            </Button>
                          )}
                        </div>
                      </div>

                      {showRestOfForm && (
                        <div className="space-y-6 border-t border-gray-700 pt-8">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                              <Label htmlFor="firstName" className="text-white font-medium">First Name</Label>
                              <Input
                                id="firstName"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                className="mt-2 bg-gray-700 border-gray-600 text-white"
                                placeholder="Enter your first name"
                              />
                            </div>
                            <div>
                              <Label htmlFor="lastName" className="text-white font-medium">Last Name</Label>
                              <Input
                                id="lastName"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                className="mt-2 bg-gray-700 border-gray-600 text-white"
                                placeholder="Enter your last name"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="email" className="text-white font-medium">Email Address</Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className="mt-2 bg-gray-700 border-gray-600 text-white"
                              placeholder="Enter your email address"
                            />
                          </div>

                          {queueRequestedDate && (
                            <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4 space-y-3">
                              <p className="text-sm text-blue-100">
                                You asked to queue for {moment(queueRequestedDate).format('MMMM D')}.
                              </p>
                              <div className="space-y-2 text-sm text-gray-200">
                                <Label className="text-xs text-blue-100">Preferred time</Label>
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-2 text-white text-sm">
                                    <input
                                      type="radio"
                                      checked={queuePreferAnytime}
                                      onChange={() => setQueuePreferAnytime(true)}
                                    />
                                    Anytime that day
                                  </label>
                                  <label className="flex items-center gap-2 text-white text-sm">
                                    <input
                                      type="radio"
                                      checked={!queuePreferAnytime}
                                      onChange={() => setQueuePreferAnytime(false)}
                                    />
                                    Choose time
                                  </label>
                                </div>
                                {!queuePreferAnytime && (
                                  <select
                                    value={queuePreferredTime}
                                    onChange={(e) => setQueuePreferredTime(e.target.value)}
                                    className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                                  >
                                    {queueTimeOptions.length === 0 ? (
                                      <option value="">No times available</option>
                                    ) : (
                                      queueTimeOptions.map((t) => (
                                        <option key={`queue-time-${t}`} value={t}>
                                          {t}
                                        </option>
                                      ))
                                    )}
                                  </select>
                                )}
                              </div>
                              <Button
                                onClick={handleJoinQueue}
                                className="w-full bg-white text-black hover:bg-gray-200"
                                disabled={queueJoined || isJoiningQueue}
                              >
                                {queueJoined
                                  ? 'Waiting for a slot to open'
                                  : isJoiningQueue
                                  ? 'Joining queue...'
                                  : `Join queue for ${moment(queueRequestedDate).format('MMM D')}`}
                              </Button>
                              {queueJoined && (
                                <p className="text-xs text-blue-200">
                                  You will receive a text if a slot opens up and the booking is created automatically.
                                </p>
                              )}
                            </div>
                          )}

                          {!queueRequestedDate && (
                          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-white font-medium">Multiple bookings</p>
                                <p className="text-sm text-gray-400">
                                  Select how many additional guests to add; their forms will appear below.
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs uppercase tracking-wide text-gray-300">
                                  Add bookings
                                </Label>
                                <select
                                  value={guestEntries.length}
                                  onChange={(e) =>
                                    updateGuestCount(Math.min(maxAdditionalGuests, Number(e.target.value) || 0))
                                  }
                                  disabled={!formData.date || maxAdditionalGuests === 0}
                                  className="bg-gray-900 border border-gray-600 rounded-lg text-white px-3 py-2 text-sm disabled:opacity-60"
                                >
                                  <option value={0}>None</option>
                                  {Array.from({ length: maxAdditionalGuests }, (_, idx) => idx + 1).map((count) => (
                                    <option key={`guest-count-${count}`} value={count}>
                                      {count} {count === 1 ? 'booking' : 'bookings'}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            {!formData.date && (
                              <p className="text-xs text-amber-300">
                                Select a date and time to enable additional bookings.
                              </p>
                            )}
                            {formData.date && maxAdditionalGuests === 0 && (
                              <p className="text-xs text-amber-300">
                                Only one slot remains on this day, so no more bookings can be added.
                              </p>
                            )}
                            <div className="space-y-4">
                              {guestEntries.map((guest, index) => (
                                <div
                                  key={`guest-${index}`}
                                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-white font-medium">Additional booking {index + 1}</p>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeGuestEntry(index)}
                                      className="text-gray-400"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                      <Label className="text-white font-medium text-xs">First Name</Label>
                                      <Input
                                        value={guest.firstName}
                                        onChange={(e) =>
                                          updateGuestEntry(index, { firstName: e.target.value })
                                        }
                                        placeholder="First name"
                                        className="mt-2 bg-gray-900 border-gray-600 text-white"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-white font-medium text-xs">Last Name</Label>
                                      <Input
                                        value={guest.lastName}
                                        onChange={(e) =>
                                          updateGuestEntry(index, { lastName: e.target.value })
                                        }
                                        placeholder="Last name"
                                        className="mt-2 bg-gray-900 border-gray-600 text-white"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-white font-medium text-xs">Email (optional)</Label>
                                    <Input
                                      type="email"
                                      value={guest.email}
                                      onChange={(e) =>
                                        updateGuestEntry(index, { email: e.target.value })
                                      }
                                      placeholder="Email address"
                                      className="mt-2 bg-gray-900 border-gray-600 text-white"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-white font-medium text-xs">Service</Label>
                                    <select
                                      className="w-full bg-gray-900 border border-gray-600 rounded-lg text-white px-3 py-2 mt-2"
                                      value={guest.serviceId}
                                      onChange={(e) =>
                                        updateGuestEntry(index, { serviceId: e.target.value })
                                      }
                                    >
                                      <option value="">Select service</option>
                                      {services.map((svc) => (
                                        <option
                                          key={`guest-${index}-svc-${svc._id}`}
                                          value={svc._id}
                                        >
                                          {svc.name} • {getAdaptiveDuration(svc)} mins
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <Label className="text-white font-medium text-xs">Time</Label>
                                    {guestSlotsLoading[index] ? (
                                      <div className="mt-2 flex justify-center items-center h-20">
                                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                                      </div>
                                    ) : (
                                      <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {timeOptionsForGuest(index, guest.time).map((slot) => (
                                          <button
                                            key={`guest-${index}-time-${slot}`}
                                            onClick={() => updateGuestEntry(index, { time: slot })}
                                            className={`text-sm rounded-lg border-2 py-2 transition-all duration-200 ${
                                              guest.time === slot
                                                ? 'border-white bg-white text-black'
                                                : 'border-gray-600 bg-gray-800 text-white hover:border-gray-400'
                                            }`}
                                          >
                                            {slot}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          )}

                          <div>
                            <Label htmlFor="notes" className="text-white font-medium">Special Requests (Optional)</Label>
                            <Textarea
                              id="notes"
                              value={formData.notes}
                              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                              placeholder="Any special requests or notes for your barber..."
                              className="mt-2 bg-gray-700 border-gray-600 text-white min-h-[100px]"
                            />
                          </div>

                          {!queueRequestedDate && (
                            <div>
                              <Label className="text-white font-medium mb-4 block">Payment Option</Label>
                              <RadioGroup
                                value={formData.paymentMethod}
                                onValueChange={(value) =>
                                  setFormData({ ...formData, paymentMethod: value as 'in-person' | 'now' })
                                }
                                className="space-y-3"
                              >
                                {/* Pay at Appointment */}
                                {payAtAppointmentAllowed && (
                                  <div
                                    onClick={() => setFormData({ ...formData, paymentMethod: 'in-person' })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setFormData({ ...formData, paymentMethod: 'in-person' });
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                                      formData.paymentMethod === 'in-person'
                                        ? 'border-white bg-gray-700'
                                        : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <RadioGroupItem
                                        value="in-person"
                                        id="in-person"
                                      />
                                      <Label htmlFor="in-person" className="text-white cursor-pointer">
                                        Pay at Appointment
                                      </Label>
                                    </div>
                                  </div>
                                )}

                                {/* Pay Now */}
                                <div
                                  onClick={() => setFormData({ ...formData, paymentMethod: 'now' })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setFormData({ ...formData, paymentMethod: 'now' });
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                                    formData.paymentMethod === 'now'
                                      ? 'border-white bg-gray-700'
                                      : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <RadioGroupItem
                                      value="now"
                                      id="now"
                                    />
                                    <Label htmlFor="now" className="text-white cursor-pointer">
                                      Pay Now (Interac e-Transfer)
                                    </Label>
                                  </div>
                                </div>
                              </RadioGroup>
                              {!isQueueFlow && needsPrepay && (
                                <p className="text-xs text-amber-300 mt-2">
                                  You have multiple cancellations on record, so we now require the Pay Now option.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Confirmation */}
                  {step === 4 && (
                    <div className="space-y-6">
                      <div className="bg-gray-700 p-6 rounded-lg border border-gray-600">
                        <h3 className="text-lg lg:text-xl font-bold text-white mb-6">Booking Summary</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-2 border-b border-gray-600">
                            <span className="text-gray-300">Service:</span>
                            <span className="font-semibold text-white">{selectedService?.name}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-600">
                            <span className="text-gray-300">Date:</span>
                            <span className="font-semibold text-white">
                              {formData.date && moment(formData.date).format('MMMM DD, YYYY')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-600">
                            <span className="text-gray-300">Time:</span>
                            <span className="font-semibold text-white">{formData.time}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-600">
                            <span className="text-gray-300">Duration:</span>
                            <span className="font-semibold text-white">
                              {selectedServiceDuration} minutes
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-t border-gray-500">
                            <span className="text-base lg:text-lg font-semibold text-white">Total:</span>
                            <span className="text-xl lg:text-2xl font-bold text-white">
                              {bookingTotal > 0 ? `$${bookingTotal}` : '$0'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-blue-900/30 border border-blue-700 p-6 rounded-lg">
                        <h4 className="font-semibold text-white mb-3">Important Information:</h4>
                        <ul className="list-disc list-inside space-y-2 text-gray-300">
                          <li>Please arrive 5-10 minutes before your appointment</li>
                          <li>Cancellations must be made 24 hours in advance</li>
                          <li>You will receive an email confirmation shortly</li>
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
                    <CardTitle className="text-white">Booking Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedService ? (
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">{selectedService.name}</h4>
                        <p className="text-gray-300 text-sm mb-2">{selectedServiceDuration} minutes</p>
                        <p className="text-xl font-bold text-white">
                          Total: {bookingTotal > 0 ? `$${bookingTotal}` : '$0'}
                        </p>
                        {guestEntries.length > 0 && (
                          <p className="text-xs text-gray-300 mt-1">
                            Includes {guestEntries.length} additional booking{guestEntries.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-700 rounded-lg text-gray-400">Select a service to begin.</div>
                    )}

                    {formData.date && (
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Date</h4>
                        <p className="text-gray-300">{moment(formData.date).format('MMMM DD, YYYY')}</p>
                      </div>
                    )}

                    {formData.time && (
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Time</h4>
                        <p className="text-gray-300">{formData.time}</p>
                      </div>
                    )}

                    <div className="p-4 bg-gray-700 rounded-lg">
                      <h4 className="font-semibold text-white mb-2">Contact Info</h4>
                      <p className="text-gray-300 text-sm">📍 646 Upper James Street, Hamilton ON, L9C 2Z2</p>
                      <p className="text-gray-300 text-sm">📞 (365) 323-3680</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Navigation Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-40">
        <div className="container-max section-padding">
          <div className="flex justify-between items-center">
            <Button
              onClick={handleBack}
              disabled={step === 1 || isLoading}
              className={`${step === 1 ? 'invisible' : ''} bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200`}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {step < 4 ? (
              queueRequestedDate && step === 3 ? (
                <Button
                  onClick={handleJoinQueue}
                  disabled={
                    queueJoined ||
                    isJoiningQueue ||
                    !formData.phone ||
                    !isValidPhoneNumber(formData.phone) ||
                    !showRestOfForm ||
                    !formData.firstName ||
                    !formData.email ||
                    (!queuePreferAnytime && !queuePreferredTime)
                  }
                  className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
                >
                  {isJoiningQueue ? 'Joining queue...' : 'Join queue'}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={
                    (step === 1 && !formData.serviceId) ||
                    (step === 2 && (!formData.date || !formData.time)) ||
                    (step === 3 &&
                      (!formData.phone ||
                        !isValidPhoneNumber(formData.phone) ||
                        !showRestOfForm ||
                        !formData.firstName ||
                        !formData.email))
                  }
                  className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200"
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-white text-black border border-transparent hover:border-blue-400 hover:bg-gray-100 hover:shadow-lg transition-all duration-200 w-48"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Confirm Booking'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (queueConfirmation) {
    const qc = queueConfirmation!;
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="container-max section-padding py-12">
          <div className="max-w-xl mx-auto text-center bg-gray-800 border border-gray-700 rounded-lg p-8 lg:p-12">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">You’re on the Queue</h1>
            <p className="text-gray-300 mb-6">
              We’ll text you at {formData.phone} if a slot opens on{' '}
              {moment(qc.date).format('MMMM D')}.
            </p>
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-left text-sm text-gray-200 space-y-2 mb-6">
              <div className="flex justify-between">
                <span>Preferred time</span>
                <span>{qc.preferAnytime ? 'Anytime that day' : qc.desiredTime || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="capitalize">{formData.paymentMethod === 'now' ? 'Pay now required on confirmation' : 'Pay at appointment'}</span>
              </div>
            </div>
            <div className="space-y-3">
              <Button onClick={() => router.push('/services')} className="w-full bg-white text-black hover:bg-gray-200">
                Back to services
              </Button>
              <Button variant="outline" onClick={() => setQueueConfirmation(null)} className="w-full border-gray-600 text-white">
                Make another booking
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
