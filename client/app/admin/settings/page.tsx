// dopecut/dopekuts-main/app/admin/settings/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Calendar as CalendarIcon, KeyRound, Copy, Check, AlertTriangle } from 'lucide-react';
import moment from 'moment';
import { toast } from 'sonner';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/lib/api/notifications';
import { getWeeklyCalendar, updateWeeklyCalendar } from '@/lib/api/calendar';
import {
  getApiKeyStatus,
  generateApiKey,
  revokeApiKey,
  type ApiKeyStatus,
} from '@/lib/api/apiKeys';
import { clearAllBookingsAndQueue } from '@/lib/api/booking';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

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
const DEFAULT_SLOT_DURATION = 45;

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
  const [calendarWeeks, setCalendarWeeks] = useState(3);
  const [calendarSlotDuration, setCalendarSlotDuration] = useState<number>(DEFAULT_SLOT_DURATION);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarSavedAt, setCalendarSavedAt] = useState<number | null>(null);
  const [durationPreset, setDurationPreset] = useState<'standard' | 'legacy'>('standard');
  const [durationPresetSaving, setDurationPresetSaving] = useState(false);
  const slotDurationSyncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [apiKeyActionLoading, setApiKeyActionLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const CLEAR_ALL_CONFIRM_PHRASE = 'DELETE ALL BOOKINGS';
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');
  const [clearAllLoading, setClearAllLoading] = useState(false);

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
      if (s.durationPreset === 'standard' || s.durationPreset === 'legacy') {
        setDurationPreset(s.durationPreset);
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

  const loadApiKeyStatus = useCallback(async () => {
    setApiKeyLoading(true);
    try {
      const status = await getApiKeyStatus();
      setApiKeyStatus(status);
    } catch (err) {
      console.error('Failed to load API key status:', err);
    } finally {
      setApiKeyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApiKeyStatus();
  }, [loadApiKeyStatus]);

  const handleGenerateApiKey = async () => {
    if (
      apiKeyStatus?.active &&
      !window.confirm('Generating a new key immediately revokes the current one. Continue?')
    ) {
      return;
    }
    setApiKeyActionLoading(true);
    setKeyCopied(false);
    try {
      const result = await generateApiKey();
      setGeneratedKey(result.key);
      await loadApiKeyStatus();
      toast.success('API key generated.');
    } catch (err) {
      console.error('Failed to generate API key:', err);
      toast.error('Failed to generate API key.');
    } finally {
      setApiKeyActionLoading(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!window.confirm('Revoke the AI booking API key? Anything using it will stop working immediately.')) {
      return;
    }
    setApiKeyActionLoading(true);
    try {
      await revokeApiKey();
      setGeneratedKey(null);
      await loadApiKeyStatus();
      toast.success('API key revoked.');
    } catch (err) {
      console.error('Failed to revoke API key:', err);
      toast.error('Failed to revoke API key.');
    } finally {
      setApiKeyActionLoading(false);
    }
  };

  const handleClearAllBookings = async () => {
    if (clearAllConfirmText !== CLEAR_ALL_CONFIRM_PHRASE) return;
    setClearAllLoading(true);
    try {
      const result = await clearAllBookingsAndQueue();
      toast.success(`Deleted ${result.deletedBookings} bookings and ${result.deletedQueueEntries} queue entries.`);
      setClearAllDialogOpen(false);
      setClearAllConfirmText('');
    } catch (err) {
      console.error('Failed to clear all bookings/queue:', err);
      toast.error('Failed to clear bookings and queue.');
    } finally {
      setClearAllLoading(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      toast.error('Could not copy automatically -- select and copy the key manually.');
    }
  };

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

  const handleDurationPresetChange = useCallback(
    async (next: 'standard' | 'legacy') => {
      if (next === durationPreset) return;
      const prev = durationPreset;
      setDurationPreset(next);
      setDurationPresetSaving(true);
      try {
        await updateNotificationSettings({ durationPreset: next });
        toast.success(
          next === 'standard'
            ? 'Service durations set to 15 / 30 / 45 / 60 minutes.'
            : 'Service durations set to 20 / 40 minutes.',
          { id: 'duration-preset-updated' }
        );
      } catch (err: any) {
        setDurationPreset(prev);
        toast.error(err?.message || 'Failed to save duration preset.');
      } finally {
        setDurationPresetSaving(false);
      }
    },
    [durationPreset]
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
          <div className="space-y-2 sm:col-span-3">
            <Label className="text-xs text-gray-400 uppercase tracking-wide">
              Service duration options
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={durationPresetSaving}
                onClick={() => handleDurationPresetChange('standard')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm border transition-colors ${
                  durationPreset === 'standard'
                    ? 'bg-white text-black border-white'
                    : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
                }`}
              >
                Standard — 15 / 30 / 45 / 60 min
              </button>
              <button
                type="button"
                disabled={durationPresetSaving}
                onClick={() => handleDurationPresetChange('legacy')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm border transition-colors ${
                  durationPreset === 'legacy'
                    ? 'bg-white text-black border-white'
                    : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
                }`}
              >
                Legacy — 20 / 40 min (dopecuts.ca)
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Controls which duration options show up when adding or editing a service.
              Switching this does not change any service you&apos;ve already set up.
            </p>
          </div>
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

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-white" />
            <CardTitle className="text-white">AI Booking Access</CardTitle>
          </div>
          <CardDescription className="text-gray-300">
            Let an AI app (like Claude) create bookings for you when you give it customer
            details and ask it to. Generate a key, give it to the AI app, and revoke it anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeyLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <>
              {apiKeyStatus?.active ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-1">
                  <p className="text-sm text-white font-medium">
                    Active key: <span className="font-mono">{apiKeyStatus.keyPrefix}…</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Created {moment(apiKeyStatus.createdAt).format('MMM D, YYYY h:mm A')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {apiKeyStatus.lastUsedAt
                      ? `Last used ${moment(apiKeyStatus.lastUsedAt).format('MMM D, YYYY h:mm A')}`
                      : 'Not used yet'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No active key. Generate one to get started.</p>
              )}

              {generatedKey && (
                <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-amber-200 font-medium">
                    Copy this key now -- it will not be shown again.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white break-all">
                      {generatedKey}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyApiKey}
                      className="shrink-0 p-2 rounded-lg bg-gray-900 border border-gray-700 text-white hover:bg-gray-800"
                    >
                      {keyCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      <span className="sr-only">Copy key</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={apiKeyActionLoading}
                  onClick={handleGenerateApiKey}
                  className="rounded-lg px-4 py-2 text-sm font-medium bg-white text-black hover:bg-gray-200 disabled:opacity-60"
                >
                  {apiKeyStatus?.active ? 'Generate New Key' : 'Generate Key'}
                </button>
                {apiKeyStatus?.active && (
                  <button
                    type="button"
                    disabled={apiKeyActionLoading}
                    onClick={handleRevokeApiKey}
                    className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-900 border border-red-700 text-red-300 hover:bg-red-950 disabled:opacity-60"
                  >
                    Revoke Key
                  </button>
                )}
              </div>

              <div className="text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded-lg p-3 space-y-1">
                <p className="text-gray-300 font-medium">How an AI app uses it:</p>
                <p>
                  POST to <code className="text-gray-200">{`${process.env.NEXT_PUBLIC_API_URL || ''}/external/bookings`}</code>{' '}
                  with header <code className="text-gray-200">Authorization: Bearer &lt;key&gt;</code> and the same
                  fields as a normal booking (service, date, time, name, phone, email, payment method).
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-red-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <CardTitle className="text-white">Danger Zone</CardTitle>
          </div>
          <CardDescription className="text-gray-300">
            For a clean launch: permanently deletes every booking (confirmed, pending, and
            cancelled) and every queue entry. Your availability settings, services, and saved
            customer contacts are not touched. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => setClearAllDialogOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-red-900 border border-red-700 text-red-100 hover:bg-red-800"
          >
            Clear All Bookings &amp; Queue
          </button>
        </CardContent>
      </Card>

      <Dialog
        open={clearAllDialogOpen}
        onOpenChange={(open) => {
          setClearAllDialogOpen(open);
          if (!open) setClearAllConfirmText('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all bookings &amp; queue?</DialogTitle>
            <DialogDescription>
              This permanently deletes every booking and every queue entry from the database.
              Availability settings, services, and saved contacts are not affected. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white font-medium">
              Type <span className="font-mono">{CLEAR_ALL_CONFIRM_PHRASE}</span> to confirm
            </Label>
            <Input
              value={clearAllConfirmText}
              onChange={(e) => setClearAllConfirmText(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white"
              placeholder={CLEAR_ALL_CONFIRM_PHRASE}
            />
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setClearAllDialogOpen(false)}
              disabled={clearAllLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClearAllBookings}
              disabled={clearAllLoading || clearAllConfirmText !== CLEAR_ALL_CONFIRM_PHRASE}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              {clearAllLoading ? 'Deleting...' : 'Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
