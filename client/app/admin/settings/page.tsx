// dopecut/dopekuts-main/app/admin/settings/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Calendar as CalendarIcon } from 'lucide-react';
import moment from 'moment';
import { toast } from 'sonner';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/lib/api/notifications';
import { getWeeklyCalendar, updateWeeklyCalendar } from '@/lib/api/calendar';

type SavingKey =
  | 'emailEnabled'
  | 'smsEnabled'
  | 'autoSendBookingConfirmations'
  | 'timezone'
  | 'siteNoticeEnabled'
  | 'productNoticeEnabled';

const fallbackTimezones = [
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Vancouver',
  'Europe/London',
  'UTC',
];

const STORAGE_START = 'admin-calendar-start';
const STORAGE_WEEKS = 'admin-calendar-weeks';
const STORAGE_SLOT_DURATION = 'admin-calendar-slot-duration';
const STORAGE_VISUALIZER = 'admin-calendar-visualizer-enabled';
const DEFAULT_SLOT_DURATION = 40;

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [bookingConfirmations, setBookingConfirmations] = useState(true);
  const [timezone, setTimezone] = useState('America/Toronto');
  const [siteNoticeEnabled, setSiteNoticeEnabled] = useState(false);
  const [siteNoticeMessage, setSiteNoticeMessage] = useState('');
  const [productNoticeEnabled, setProductNoticeEnabled] = useState(false);
  const [productNoticeMessage, setProductNoticeMessage] = useState('');
  const [visualizerEnabled, setVisualizerEnabled] = useState(true);
  const [calendarStart, setCalendarStart] = useState(moment().startOf('isoWeek').format('YYYY-MM-DD'));
  const [calendarWeeks, setCalendarWeeks] = useState(4);
  const [calendarSlotDuration, setCalendarSlotDuration] = useState<number>(DEFAULT_SLOT_DURATION);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarSavedAt, setCalendarSavedAt] = useState<number | null>(null);
  const slotDurationSyncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState<Record<SavingKey, boolean>>({
    emailEnabled: false,
    smsEnabled: false,
    autoSendBookingConfirmations: false,
    timezone: false,
    siteNoticeEnabled: false,
    productNoticeEnabled: false,
  });
  const [saveError, setSaveError] = useState<Record<SavingKey, string | null>>({
    emailEnabled: null,
    smsEnabled: null,
    autoSendBookingConfirmations: null,
    timezone: null,
    siteNoticeEnabled: null,
    productNoticeEnabled: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const s: NotificationSettings = await getNotificationSettings();
      setEmailNotifications(!!s.emailEnabled);
      setSmsNotifications(!!s.smsEnabled);
      setBookingConfirmations(!!s.autoSendBookingConfirmations);
      setTimezone(s.timezone || 'America/Toronto');
      setSiteNoticeEnabled(!!s.siteNoticeEnabled);
      setSiteNoticeMessage(s.siteNoticeMessage || '');
      setProductNoticeEnabled(!!s.productNoticeEnabled);
      setProductNoticeMessage(s.productNoticeMessage || '');
      if (s.calendarWeeks) {
        setCalendarWeeks(Math.min(12, Math.max(1, s.calendarWeeks)));
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load notification settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fire and forget
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedStart = window.localStorage.getItem(STORAGE_START);
    const storedWeeks = window.localStorage.getItem(STORAGE_WEEKS);
    const storedSlotDuration = window.localStorage.getItem(STORAGE_SLOT_DURATION);
    const storedVisualizer = window.localStorage.getItem(STORAGE_VISUALIZER);
    if (storedStart) setCalendarStart(storedStart);
    const parsedWeeks = storedWeeks ? parseInt(storedWeeks, 10) : NaN;
    if (!Number.isNaN(parsedWeeks) && parsedWeeks > 0) {
      setCalendarWeeks(Math.min(12, parsedWeeks));
    }
    const parsedDuration = storedSlotDuration ? parseInt(storedSlotDuration, 10) : NaN;
    if (!Number.isNaN(parsedDuration) && parsedDuration > 0) {
      setCalendarSlotDuration(parsedDuration);
    }
    if (storedVisualizer !== null) {
      setVisualizerEnabled(storedVisualizer === 'true');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (slotDurationSyncTimeout.current) {
        clearTimeout(slotDurationSyncTimeout.current);
      }
    };
  }, []);

  const timezoneOptions = useMemo(() => {
    const supported = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;
    return (supported?.length ? supported : fallbackTimezones).slice(0);
  }, []);

  const handleToggle = useCallback(
    async (key: SavingKey, nextValue: boolean, revert: () => void) => {
      setSaveError(prev => ({ ...prev, [key]: null }));
      setSaving(prev => ({ ...prev, [key]: true }));
      try {
        await updateNotificationSettings({ [key]: nextValue });
      } catch (err: any) {
        setSaveError(prev => ({
          ...prev,
          [key]: err?.message || 'Failed to save. Please try again.',
        }));
        // rollback local state
        revert();
      } finally {
        setSaving(prev => ({ ...prev, [key]: false }));
      }
    },
    []
  );

  const handleTimezoneChange = useCallback(
    async (nextTz: string) => {
      const prev = timezone;
      setSaveError((cur) => ({ ...cur, timezone: null }));
      setSaving((cur) => ({ ...cur, timezone: true }));
      setTimezone(nextTz);
      try {
        await updateNotificationSettings({ timezone: nextTz });
      } catch (err: any) {
        setSaveError((cur) => ({
          ...cur,
          timezone: err?.message || 'Failed to save timezone. Please try again.',
        }));
        setTimezone(prev);
      } finally {
        setSaving((cur) => ({ ...cur, timezone: false }));
      }
    },
    [timezone]
  );

  const persistCalendarSettings = useCallback(
    (nextStart: string, nextWeeks: number, nextSlotDuration?: number) => {
      if (typeof window === 'undefined') return;
      const slotDuration = nextSlotDuration ?? calendarSlotDuration ?? DEFAULT_SLOT_DURATION;
      window.localStorage.setItem(STORAGE_START, nextStart);
      window.localStorage.setItem(STORAGE_WEEKS, String(nextWeeks));
      window.localStorage.setItem(STORAGE_SLOT_DURATION, String(slotDuration));
      window.dispatchEvent(
        new CustomEvent('calendar-settings-changed', {
          detail: { startDate: nextStart, weeksToShow: nextWeeks, slotDuration },
        })
      );
      toast.success('Calendar settings updated', { id: 'calendar-settings-updated' });
    },
    [calendarSlotDuration]
  );

  const persistVisualizerEnabled = useCallback(
    (enabled: boolean) => {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(STORAGE_VISUALIZER, String(enabled));
      window.dispatchEvent(
        new CustomEvent('calendar-settings-changed', {
          detail: { visualizerEnabled: enabled },
        })
      );
      toast.success(`Daily Booking Visualizer ${enabled ? 'enabled' : 'disabled'}`, {
        id: 'visualizer-updated',
      });
    },
    []
  );

  const applySlotDurationToAllWeeks = useCallback(
    async (duration: number) => {
      try {
        const weeksData = await getWeeklyCalendar(12, calendarStart);
        const updatedWeeks = weeksData.map((week) => ({
          ...week,
          slotDuration: duration,
          days: week.days.map((day) => ({ ...day, slotDuration: duration })),
        }));
        await updateWeeklyCalendar(updatedWeeks);
        toast.success('Default slot duration applied to all weeks.', { id: 'slot-duration-sync' });
      } catch (err: any) {
        toast.error(err?.message || 'Failed to apply default slot duration to weekly calendar.');
      } finally {
        setCalendarSaving(false);
        setCalendarSavedAt(Date.now());
      }
    },
    [calendarStart]
  );

  const emailHelp = useMemo(
    () =>
      saveError.emailEnabled
        ? saveError.emailEnabled
        : 'Receive booking updates via email',
    [saveError.emailEnabled]
  );

  const smsHelp = useMemo(
    () =>
      saveError.smsEnabled
        ? saveError.smsEnabled
        : 'Get text messages for new bookings',
    [saveError.smsEnabled]
  );

  const confirmationHelp = useMemo(
    () =>
      saveError.autoSendBookingConfirmations
        ? saveError.autoSendBookingConfirmations
        : 'Auto-send confirmation emails',
    [saveError.autoSendBookingConfirmations]
  );

  const timezoneHelp = useMemo(
    () =>
      saveError.timezone
        ? saveError.timezone
        : 'All booking times will be aligned to this timezone.',
    [saveError.timezone]
  );

  const noticeHelp = 'Show a dismissible modal to visitors on page load.';
  const productNoticeHelp = 'Show a dismissible modal to visitors on product page load.';

  return (
    <div className="space-y-4 md:space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription className="text-gray-300">
            Configure notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-gray-300 text-sm">Loading settings…</div>
          ) : fetchError ? (
            <div className="text-red-400 text-sm">{fetchError}</div>
          ) : (
            <>
              {/* Email */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="emailNotif" className="text-white text-sm md:text-base">
                    Email Notifications
                  </Label>
                  <p
                    className={`text-xs sm:text-sm ${
                      saveError.emailEnabled ? 'text-red-400' : 'text-gray-400'
                    }`}
                  >
                    {emailHelp}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saving.emailEnabled && (
                    <span className="text-xs text-gray-400">Saving…</span>
                  )}
                  <Switch
                    id="emailNotif"
                    checked={emailNotifications}
                    disabled={saving.emailEnabled}
                    onCheckedChange={(checked) => {
                      const prev = emailNotifications;
                      setEmailNotifications(checked);
                      void handleToggle('emailEnabled', checked, () => setEmailNotifications(prev));
                    }}
                  />
                </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Daily Booking Visualizer Toggle */}
        <Card className="bg-gray-800 border border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Daily Booking Visualizer
            </CardTitle>
            <CardDescription className="text-gray-300">
              Enable or disable the day-view visualizer on the Admin Calendar page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white text-sm md:text-base">
                  Show Daily Booking Visualizer
                </Label>
                <p className="text-xs sm:text-sm text-gray-400">
                  Controls whether the visual timeline appears on the admin calendar.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={visualizerEnabled}
                  onCheckedChange={(checked) => {
                    setVisualizerEnabled(checked);
                    persistVisualizerEnabled(checked);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator className="bg-gray-700" />

              {/* SMS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="smsNotif" className="text-white text-sm md:text-base">
                    SMS Notifications
                  </Label>
                  <p
                    className={`text-xs sm:text-sm ${
                      saveError.smsEnabled ? 'text-red-400' : 'text-gray-400'
                    }`}
                  >
                    {smsHelp}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saving.smsEnabled && (
                    <span className="text-xs text-gray-400">Saving…</span>
                  )}
                  <Switch
                    id="smsNotif"
                    checked={smsNotifications}
                    disabled={saving.smsEnabled}
                    onCheckedChange={(checked) => {
                      const prev = smsNotifications;
                      setSmsNotifications(checked);
                      void handleToggle('smsEnabled', checked, () => setSmsNotifications(prev));
                    }}
                  />
                </div>
              </div>

              <Separator className="bg-gray-700" />

              {/* Booking Confirmations */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="bookingConfirm" className="text-white text-sm md:text-base">
                    Booking Confirmations
                  </Label>
                  <p
                    className={`text-xs sm:text-sm ${
                      saveError.autoSendBookingConfirmations ? 'text-red-400' : 'text-gray-400'
                    }`}
                  >
                    {confirmationHelp}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saving.autoSendBookingConfirmations && (
                    <span className="text-xs text-gray-400">Saving…</span>
                  )}
                  <Switch
                    id="bookingConfirm"
                    checked={bookingConfirmations}
                    disabled={saving.autoSendBookingConfirmations}
                    onCheckedChange={(checked) => {
                      const prev = bookingConfirmations;
                      setBookingConfirmations(checked);
                      void handleToggle(
                        'autoSendBookingConfirmations',
                        checked,
                        () => setBookingConfirmations(prev)
                      );
                    }}
                  />
                </div>
              </div>

              <Separator className="bg-gray-700" />

              {/* Timezone */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="timezone" className="text-white text-sm md:text-base">
                    Business Timezone
                  </Label>
                  <p
                    className={`text-xs sm:text-sm ${
                      saveError.timezone ? 'text-red-400' : 'text-gray-400'
                    }`}
                  >
                    {timezoneHelp}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saving.timezone && <span className="text-xs text-gray-400">Saving…</span>}
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => void handleTimezoneChange(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {timezoneOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Separator className="bg-gray-700" />

              {/* Site Notice */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="siteNotice" className="text-white text-sm md:text-base">
                Site Notice Modal
                    </Label>
                    <p className="text-xs sm:text-sm text-gray-400">{noticeHelp}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {saving.siteNoticeEnabled && <span className="text-xs text-gray-400">Saving…</span>}
                    <Switch
                      id="siteNotice"
                      checked={siteNoticeEnabled}
                      disabled={saving.siteNoticeEnabled}
                      onCheckedChange={(checked) => {
                        const prev = siteNoticeEnabled;
                        setSiteNoticeEnabled(checked);
                        void handleToggle('siteNoticeEnabled', checked, () => setSiteNoticeEnabled(prev));
                      }}
                    />
                  </div>
                </div>
                {siteNoticeEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="siteNoticeMessage" className="text-xs text-gray-400 uppercase tracking-wide">
                      Notice message
                    </Label>
                    <textarea
                      id="siteNoticeMessage"
                      value={siteNoticeMessage}
                      onChange={(e) => setSiteNoticeMessage(e.target.value)}
                      onBlur={async () => {
                        try {
                          await updateNotificationSettings({ siteNoticeMessage });
                          toast.success('Notice message saved');
                        } catch (err: any) {
                          toast.error(err?.message || 'Failed to save notice message.');
                        }
                      }}
                      rows={3}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder="Enter the message shown to visitors..."
                    />
                  </div>
                )}
              </div>

              <Separator className="bg-gray-700" />

              {/* Product Notice */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="productNotice" className="text-white text-sm md:text-base">
                      Product Notice Modal
                    </Label>
                    <p className="text-xs sm:text-sm text-gray-400">{productNoticeHelp}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {saving.productNoticeEnabled && <span className="text-xs text-gray-400">Saving…</span>}
                    <Switch
                      id="productNotice"
                      checked={productNoticeEnabled}
                      disabled={saving.productNoticeEnabled}
                      onCheckedChange={(checked) => {
                        const prev = productNoticeEnabled;
                        setProductNoticeEnabled(checked);
                        void handleToggle('productNoticeEnabled', checked, () => setProductNoticeEnabled(prev));
                      }}
                    />
                  </div>
                </div>
                {productNoticeEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="productNoticeMessage" className="text-xs text-gray-400 uppercase tracking-wide">
                      Product notice message
                    </Label>
                    <textarea
                      id="productNoticeMessage"
                      value={productNoticeMessage}
                      onChange={(e) => setProductNoticeMessage(e.target.value)}
                      onBlur={async () => {
                        try {
                          await updateNotificationSettings({ productNoticeMessage });
                          toast.success('Product notice message saved');
                        } catch (err: any) {
                          toast.error(err?.message || 'Failed to save product notice.');
                        }
                      }}
                      rows={3}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder="Enter the message shown on the product page..."
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendar Settings
          </CardTitle>
          <CardDescription className="text-gray-300">
            Control the week range shown on the Calendar page. Changes apply instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs text-gray-400 uppercase tracking-wide">Week start</Label>
            <input
              type="date"
              value={calendarStart}
              onChange={(e) => {
                const val = e.target.value || moment().startOf('isoWeek').format('YYYY-MM-DD');
                setCalendarStart(val);
                persistCalendarSettings(val, calendarWeeks);
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-gray-400 uppercase tracking-wide">Weeks shown</Label>
            <select
              value={calendarWeeks}
              onChange={(e) => {
                const n = Math.min(12, Math.max(1, Number(e.target.value) || 4));
                setCalendarWeeks(n);
                persistCalendarSettings(calendarStart, n);
                void updateNotificationSettings({ calendarWeeks: n }).catch(() => {
                  toast.error('Failed to save weeks setting.');
                });
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-gray-400 uppercase tracking-wide">
              Default slot duration (minutes)
            </Label>
            <input
              type="number"
              min={5}
              max={180}
              value={calendarSlotDuration}
              onChange={(e) => {
                const next = Math.max(5, Math.min(180, Number(e.target.value) || DEFAULT_SLOT_DURATION));
                setCalendarSaving(true);
                setCalendarSlotDuration(next);
                persistCalendarSettings(calendarStart, calendarWeeks, next);
                if (slotDurationSyncTimeout.current) {
                  clearTimeout(slotDurationSyncTimeout.current);
                }
                slotDurationSyncTimeout.current = setTimeout(() => {
                  void applySlotDurationToAllWeeks(next);
                }, 400);
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <p className="text-xs text-gray-400">
              {calendarSaving
                ? 'Auto-saving…'
                : calendarSavedAt
                  ? 'Auto-saved'
                  : 'Updates apply instantly'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
