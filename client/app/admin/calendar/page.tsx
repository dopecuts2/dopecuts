// app/admin/calendar/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2, Clock3, User, XCircle, X } from 'lucide-react';
import moment from 'moment';
import {
  getWeeklyCalendar,
  updateWeeklyCalendar,
  IWeeklyCalendar,
} from '@/lib/api/calendar';
import { getAllBookings, IBooking } from '@/lib/api/booking';
import { toast } from 'sonner';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  isError?: boolean;
}

const ConfirmationModal = ({ isOpen, onClose, title, message, isError = false }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-6 mx-4 bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
        <div className="flex flex-col items-center text-center">
          {isError ? (
            <XCircle className="w-12 h-12 mb-4 text-red-500" />
          ) : (
            <CheckCircle2 className="w-12 h-12 mb-4 text-green-500" />
          )}
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className="mt-2 text-sm text-gray-300">{message}</p>
          <Button
            onClick={onClose}
            className="w-full mt-6 bg-white text-black hover:bg-gray-200"
          >
            OK
          </Button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

function generateTimeOptions(start = '06:00', end = '22:00', intervalMinutes = 20) {
  const [startH, startM] = start.split(':').map((v) => parseInt(v, 10));
  const [endH, endM] = end.split(':').map((v) => parseInt(v, 10));
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  const out: string[] = [];
  for (let m = startTotal; m <= endTotal; m += intervalMinutes) {
    const h = Math.floor(m / 60)
      .toString()
      .padStart(2, '0');
    const mins = (m % 60).toString().padStart(2, '0');
    out.push(`${h}:${mins}`);
  }
  return out;
}

const timeOptions = generateTimeOptions();

const DEFAULT_SLOT_DURATION = 40;
const STORAGE_SLOT_DURATION = 'admin-calendar-slot-duration';
const STORAGE_VISUALIZER = 'admin-calendar-visualizer-enabled';
const MAX_WEEKS = 12;
const STORAGE_START = 'admin-calendar-start';
const STORAGE_WEEKS = 'admin-calendar-weeks';

export default function CalendarManagement() {
  const [weeks, setWeeks] = useState<IWeeklyCalendar[]>([]);
  const weeksRef = useRef<IWeeklyCalendar[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    isError: false,
  });
  const [weeksToShow, setWeeksToShow] = useState(4);
  const [startDate, setStartDate] = useState(moment().startOf('isoWeek').format('YYYY-MM-DD'));
  const [defaultSlotDuration, setDefaultSlotDuration] = useState<number>(DEFAULT_SLOT_DURATION);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [bookings, setBookings] = useState<IBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [selectedViewDate, setSelectedViewDate] = useState<string>(moment().format('YYYY-MM-DD'));
  const [showDayModal, setShowDayModal] = useState(false);
  const [visualizerEnabled, setVisualizerEnabled] = useState(true);
  const [showConfirmed, setShowConfirmed] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);
  const dayBookings = useMemo(() => {
    const target = moment.utc(selectedViewDate, 'YYYY-MM-DD', true);
    if (!target.isValid()) return [];
    return bookings
      .filter((b) => {
        const bookingDate = moment.utc(b.date);
        return bookingDate.format('YYYY-MM-DD') === target.format('YYYY-MM-DD');
      })
      .sort((a, b) => moment(a.time, 'h:mm A').diff(moment(b.time, 'h:mm A')));
  }, [bookings, selectedViewDate]);

  const filteredDayBookings = useMemo(() => {
    return dayBookings.filter((b) => {
      if (b.status === 'cancelled') return showCancelled;
      if (b.status === 'confirmed') return showConfirmed;
      return true; // keep pending/other statuses visible
    });
  }, [dayBookings, showCancelled, showConfirmed]);

  useEffect(() => {
    weeksRef.current = weeks;
  }, [weeks]);

  const parseTimeLabel = (label: string) => {
    const m = moment.utc(label, 'h:mm A', true);
    if (!m.isValid()) return null;
    return m.hours() * 60 + m.minutes();
  };

  const dayRange = useMemo(() => {
    if (!filteredDayBookings.length) return { start: 9 * 60, end: 19 * 60 + 40 };
    const starts = filteredDayBookings
      .map((b) => parseTimeLabel(b.time) ?? 9 * 60)
      .filter((n) => typeof n === 'number') as number[];
    const durations = filteredDayBookings.map((b) => b.duration || 40);
    const ends = starts.map((s, idx) => s + (durations[idx] ?? 40));
    const minStart = Math.min(...starts, 9 * 60);
    const maxEnd = Math.max(...ends, 19 * 60 + 40);
    const paddedStart = Math.max(0, minStart - 60);
    const paddedEnd = Math.min(24 * 60, maxEnd + 60);
    return { start: paddedStart, end: paddedEnd };
  }, [filteredDayBookings]);

  const timelineSegments = useMemo(() => {
    const span = Math.max(60, dayRange.end - dayRange.start);
    // Base segments
    const base = filteredDayBookings.map((b) => {
      const startMin = parseTimeLabel(b.time) ?? dayRange.start;
      const duration = b.duration || 40;
      const endMin = startMin + duration;
      const top = ((startMin - dayRange.start) / span) * 100;
      const height = Math.max(8, (duration / span) * 100);
      return { booking: b, top, height, startMin, endMin };
    });
    // Assign lanes to avoid overlap visually
    const laneEnds: number[] = [];
    const withLanes = base
      .slice()
      .sort((a, b) => a.startMin - b.startMin)
      .map((seg) => {
        let lane = laneEnds.findIndex((end) => seg.startMin >= end);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(seg.endMin);
        } else {
          laneEnds[lane] = seg.endMin;
        }
        return { ...seg, lane };
      });
    const maxLane = laneEnds.length - 1;
    return withLanes.map((seg) => ({
      ...seg,
      maxLane,
    }));
  }, [filteredDayBookings, dayRange]);

  const getStatusClasses = (status?: string) => {
    if (status === 'cancelled') return 'bg-red-500 text-white border-red-400';
    if (status === 'pending') return 'bg-amber-400 text-black border-amber-300';
    return 'bg-green-500 text-white border-green-400';
  };

  const fetchBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);
      setBookingsError(null);
      const data = await getAllBookings();
      setBookings(data || []);
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err);
      setBookingsError(err?.message || 'Failed to load bookings.');
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  const fetchWeeks = async () => {
    try {
      setLoading(true);
      setError(null);
      const clampedWeeks = Math.min(MAX_WEEKS, weeksToShow);
      const data = await getWeeklyCalendar(clampedWeeks, startDate);
      const normalized = data.map((week) => ({
        ...week,
        slotDuration: week.slotDuration || defaultSlotDuration,
        days: week.days.map((day) => ({
          ...day,
          slotDuration: day.slotDuration || defaultSlotDuration,
        })),
      }));
      setWeeks(normalized);
      setSelectedWeekIdx(0);
      setDirty(false);
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = null;
      }
    } catch (err) {
      console.error('Failed to fetch weekly schedule:', err);
      setError('Failed to load schedule. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWeeks();
    void fetchBookings();
    if (typeof window !== 'undefined') {
      const storedVisualizer = window.localStorage.getItem(STORAGE_VISUALIZER);
      if (storedVisualizer !== null) {
        setVisualizerEnabled(storedVisualizer === 'true');
      }
    }
  }, [weeksToShow, startDate, defaultSlotDuration, fetchBookings]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, []);

  // Refresh bookings when changing the inspected date (ensures latest data for that day)
  useEffect(() => {
    void fetchBookings();
  }, [selectedViewDate, fetchBookings]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    const original = document.body.style.overflow;
    if (showDayModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = original || '';
    }
    return () => {
      document.body.style.overflow = original || '';
    };
  }, [showDayModal]);

  useEffect(() => {
    if (selectedWeekIdx >= weeks.length) {
      setSelectedWeekIdx(Math.max(0, weeks.length - 1));
    }
  }, [weeks.length, selectedWeekIdx]);

  const scheduleAutoSave = () => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    autoSaveTimeout.current = setTimeout(() => {
      void handleSave(true);
    }, 800);
  };

  const applyGlobalSlotDuration = useCallback(
    (duration: number) => {
      let didChange = false;
      setWeeks((prev) => {
        const updated = prev.map((week) => {
          const nextDays = week.days.map((day) => {
            if (day.slotDuration !== duration) {
              didChange = true;
            }
            return { ...day, slotDuration: duration };
          });
          if (week.slotDuration !== duration) {
            didChange = true;
          }
          return { ...week, slotDuration: duration, days: nextDays };
        });
        return didChange ? updated : prev;
      });
      if (didChange) {
        setDirty(true);
        scheduleAutoSave();
      }
    },
    [scheduleAutoSave]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedStart = window.localStorage.getItem(STORAGE_START);
    const storedWeeks = window.localStorage.getItem(STORAGE_WEEKS);
    const storedVisualizer = window.localStorage.getItem(STORAGE_VISUALIZER);
    if (storedStart) setStartDate(storedStart);
    const parsedWeeks = storedWeeks ? parseInt(storedWeeks, 10) : NaN;
    if (!Number.isNaN(parsedWeeks) && parsedWeeks > 0) {
      setWeeksToShow(Math.min(MAX_WEEKS, parsedWeeks));
    }
    const storedSlotDuration = window.localStorage.getItem(STORAGE_SLOT_DURATION);
    const parsedDuration = storedSlotDuration ? parseInt(storedSlotDuration, 10) : NaN;
    if (!Number.isNaN(parsedDuration) && parsedDuration > 0) {
      setDefaultSlotDuration(parsedDuration);
    }
    if (storedVisualizer !== null) {
      setVisualizerEnabled(storedVisualizer === 'true');
    }

    const handleExternalUpdate = (event: StorageEvent) => {
      if (event.key === STORAGE_START && event.newValue) {
        setStartDate(event.newValue);
      }
      if (event.key === STORAGE_WEEKS && event.newValue) {
        const n = parseInt(event.newValue, 10);
        if (!Number.isNaN(n) && n > 0) setWeeksToShow(Math.min(MAX_WEEKS, n));
      }
      if (event.key === STORAGE_SLOT_DURATION && event.newValue) {
        const n = parseInt(event.newValue, 10);
        if (!Number.isNaN(n) && n > 0) setDefaultSlotDuration(n);
      }
      if (event.key === STORAGE_VISUALIZER && event.newValue !== null) {
        setVisualizerEnabled(event.newValue === 'true');
      }
    };

    const handleCustomUpdate = (event: Event) => {
      if (event instanceof CustomEvent) {
        const detail = (event as CustomEvent<any>).detail || {};
        if (detail.startDate) setStartDate(detail.startDate);
        if (detail.weeksToShow) setWeeksToShow(Math.min(MAX_WEEKS, detail.weeksToShow));
        if (detail.slotDuration) {
          setDefaultSlotDuration(detail.slotDuration);
          applyGlobalSlotDuration(detail.slotDuration);
        }
        if (typeof detail.visualizerEnabled === 'boolean') {
          setVisualizerEnabled(detail.visualizerEnabled);
        }
      }
    };

    window.addEventListener('storage', handleExternalUpdate);
    window.addEventListener('calendar-settings-changed', handleCustomUpdate);
    return () => {
      window.removeEventListener('storage', handleExternalUpdate);
      window.removeEventListener('calendar-settings-changed', handleCustomUpdate);
    };
  }, [applyGlobalSlotDuration]);

  const updateWeek = (index: number, updatedWeek: IWeeklyCalendar) => {
    setWeeks((prev) => prev.map((week, idx) => (idx === index ? updatedWeek : week)));
    setDirty(true);
    scheduleAutoSave();
  };

  const updateDay = (
    weekIndex: number,
    dayIndex: number,
    dayChanges: Partial<IWeeklyCalendar['days'][0]>
  ) => {
    const updated = [...weeks];
    const targetWeek = updated[weekIndex];
    if (!targetWeek) return;
    const days = [...targetWeek.days];
    days[dayIndex] = { ...days[dayIndex], ...dayChanges };
    updated[weekIndex] = { ...targetWeek, days };
    setWeeks(updated);
    setDirty(true);
    scheduleAutoSave();
  };

  const addBlockedTime = (weekIndex: number, dayIndex: number) => {
    const updated = [...weeks];
    const targetWeek = updated[weekIndex];
    if (!targetWeek) return;
    const days = [...targetWeek.days];
    const day = days[dayIndex];
    const blockedTimes = [...day.blockedTimes, { startTime: day.startTime, endTime: day.startTime }];
    days[dayIndex] = { ...day, blockedTimes };
    updated[weekIndex] = { ...targetWeek, days };
    setWeeks(updated);
    setDirty(true);
    scheduleAutoSave();
  };

  const updateBlockedTime = (
    weekIndex: number,
    dayIndex: number,
    blockedIndex: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    const updated = [...weeks];
    const targetWeek = updated[weekIndex];
    if (!targetWeek) return;
    const days = [...targetWeek.days];
    const blockedTimes = [...days[dayIndex].blockedTimes];
    blockedTimes[blockedIndex] = { ...blockedTimes[blockedIndex], [field]: value };
    days[dayIndex] = { ...days[dayIndex], blockedTimes };
    updated[weekIndex] = { ...targetWeek, days };
    setWeeks(updated);
    setDirty(true);
    scheduleAutoSave();
  };

  const removeBlockedTime = (weekIndex: number, dayIndex: number, blockedIndex: number) => {
    const updated = [...weeks];
    const targetWeek = updated[weekIndex];
    if (!targetWeek) return;
    const days = [...targetWeek.days];
    const blockedTimes = [...days[dayIndex].blockedTimes];
    blockedTimes.splice(blockedIndex, 1);
    days[dayIndex] = { ...days[dayIndex], blockedTimes };
    updated[weekIndex] = { ...targetWeek, days };
    setWeeks(updated);
    setDirty(true);
    scheduleAutoSave();
  };

  async function handleSave(isAuto = false) {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = null;
    }

    if (isAuto && isSaving) {
      autoSaveTimeout.current = setTimeout(() => {
        autoSaveTimeout.current = null;
        void handleSave(true);
      }, 500);
      return;
    }

    setIsSaving(true);
    try {
      const payload = weeksRef.current;
      await updateWeeklyCalendar(payload);
      setDirty(false);
      if (isAuto) {
        toast.success('Availability auto-saved.');
      } else {
        toast.success('Schedule updated.');
        setModalState({
          isOpen: true,
          title: 'Schedule Updated',
          message: 'Your new availability has been saved successfully.',
          isError: false,
        });
      }
    } catch (err) {
      console.error('Failed to save schedule:', err);
      if (isAuto) {
        toast.error('Auto-save failed. Click Save to retry.');
      } else {
        setModalState({
          isOpen: true,
          title: 'Update Failed',
          message: 'We could not save your schedule. Please check your connection and try again.',
          isError: true,
        });
      }
    } finally {
      setIsSaving(false);
    }
  }

  const closeModal = () =>
    setModalState({ isOpen: false, title: '', message: '', isError: false });

  const selectedWeek = weeks[selectedWeekIdx];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-white text-lg">Loading your schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-center p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-400 text-lg font-semibold">An Error Occurred</p>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <>
      <ConfirmationModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        isError={modalState.isError}
        onClose={closeModal}
      />
      {showDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDayModal(false)}
          />
          <div className="relative w-full max-w-5xl h-[80vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4 overflow-hidden flex flex-col">
            <button
              onClick={() => setShowDayModal(false)}
              className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </button>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Day view</p>
                <h3 className="text-2xl font-bold text-white">
                  {moment.utc(selectedViewDate, 'YYYY-MM-DD', true).format('dddd, MMMM D, YYYY')}
                </h3>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <span className="text-white font-semibold">
                  {filteredDayBookings.length} booking{filteredDayBookings.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <Label className="text-xs uppercase tracking-wide text-gray-400">Show confirmed</Label>
                <Switch checked={showConfirmed} onCheckedChange={setShowConfirmed} />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs uppercase tracking-wide text-gray-400">Show cancelled</Label>
                <Switch checked={showCancelled} onCheckedChange={setShowCancelled} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {bookingsLoading ? (
                <p className="text-sm text-gray-300">Loading bookings…</p>
              ) : bookingsError ? (
                <p className="text-sm text-red-400">{bookingsError}</p>
              ) : filteredDayBookings.length === 0 ? (
                <p className="text-sm text-gray-300">No bookings on this date.</p>
              ) : (
                <div className="grid grid-cols-[70px_1fr] gap-4 min-h-[400px]">
                  <div className="flex flex-col gap-4 text-[11px] text-gray-400">
                      {Array.from(
                        { length: Math.max(2, Math.ceil((dayRange.end - dayRange.start) / 60)) + 1 },
                        (_, idx) => {
                          const minuteMark = dayRange.start + idx * 60;
                          if (minuteMark > dayRange.end) return null;
                          const label = moment
                            .utc()
                            .startOf('day')
                            .minutes(minuteMark)
                            .format('h:mm A');
                          return (
                            <div key={`label-${minuteMark}`} className="h-12 flex items-start">
                              <span>{label}</span>
                            </div>
                          );
                        }
                      )}
                  </div>
                  <div className="relative bg-gray-800/70 border border-gray-700 rounded-xl p-4 overflow-hidden">
                    {timelineSegments.map(({ booking, top, height, lane, maxLane }) => {
                      const laneWidth = Math.max(60, 100 - lane * 10);
                      const left = lane * 10;
                      const statusClasses = getStatusClasses(booking.status);
                      return (
                      <div
                        key={booking._id}
                        className={`absolute rounded-lg shadow-md border p-3 space-y-1 ${statusClasses} ${
                          booking.status === 'cancelled' ? 'opacity-80' : ''
                        }`}
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          left: `${left}%`,
                          width: `calc(${laneWidth}% - 8px)`,
                        }}
                      >
                        <p className="text-sm font-semibold">
                          {booking.time} • {booking.service}
                        </p>
                        <p className="text-xs flex items-center gap-1 opacity-90">
                          <User className="h-4 w-4" />
                          {booking.firstName} {booking.lastName}
                        </p>
                        <p className="text-[11px] opacity-80">
                          {booking.duration || 40} min • {booking.status}
                        </p>
                        {booking.notes && (
                          <p className="text-[11px] opacity-80 truncate">Notes: {booking.notes}</p>
                        )}
                      </div>
                      );
                    })}
                    <div className="absolute inset-0 pointer-events-none">
                      {Array.from(
                        { length: Math.max(2, Math.ceil((dayRange.end - dayRange.start) / 60)) + 1 },
                        (_, idx) => {
                          const pos =
                            (idx / Math.max(1, Math.ceil((dayRange.end - dayRange.start) / 60))) *
                            100;
                          return (
                            <div
                              key={`grid-${idx}`}
                              className="absolute left-0 right-0 border-t border-gray-700/60"
                              style={{ top: `${pos}%` }}
                            />
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Calendar Management</h1>
          <p className="text-sm md:text-base text-gray-400">
            Configure availability per week and block any specific slots. Changes auto-save.
          </p>
        </div>

        {visualizerEnabled && (
          <Card className="bg-gray-800 border border-gray-700">
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardTitle className="text-white">Daily Booking Visualizer</CardTitle>
                <CardDescription className="text-gray-300">
                  See who is booked for a given day at a glance.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-gray-400 uppercase tracking-wide">Pick a date</Label>
                  <input
                    type="date"
                    value={selectedViewDate}
                    onChange={(e) => setSelectedViewDate(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-300">
                    {bookingsLoading && 'Loading bookings…'}
                    {bookingsError && <span className="text-red-400">{bookingsError}</span>}
                    {!bookingsLoading && !bookingsError && (
                      <span className="text-white font-semibold">
                        {filteredDayBookings.length} booking{filteredDayBookings.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowDayModal(true)}
                    disabled={bookingsLoading || !!bookingsError}
                  >
                    Open Day View
                  </Button>
                </div>
              </div>

              {!bookingsLoading && !bookingsError && (
                <>
                  {filteredDayBookings.length === 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-gray-300">
                      No bookings on this date.
                    </div>
                  )}
                  {filteredDayBookings.length > 0 && (
                    <div className="grid gap-3">
                      {filteredDayBookings.map((b) => (
                        <div
                          key={b._id}
                          className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-900 border border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-white text-black">
                              <Clock3 className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-white font-semibold">
                                {b.time} • {b.service}
                              </p>
                              <p className="text-sm text-gray-300 flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                {b.firstName} {b.lastName}
                              </p>
                              {b.notes && (
                                <p className="text-xs text-gray-400">Notes: {b.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 md:text-right">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                b.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : b.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {b.status}
                            </span>
                            <div className="text-sm text-gray-300">
                              {moment.utc(b.date).format('MMM D, YYYY')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-white">Weekly Availability</CardTitle>
              <CardDescription className="text-gray-300">
                Edit start/end times per day, add blocked periods as needed. Auto-saving is enabled.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {weeks.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex flex-col gap-1 max-w-xs w-full">
                  <Label className="text-xs text-gray-400 uppercase tracking-wide">
                    Select Week
                  </Label>
                  <select
                    value={selectedWeekIdx}
                    onChange={(e) => setSelectedWeekIdx(Number(e.target.value))}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-full"
                  >
                    {weeks.map((week, idx) => (
                      <option key={week.weekStart} value={idx}>
                        Week of {moment(week.weekStart).format('MMM D')}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-gray-300">
                  Showing schedule for{' '}
                  <span className="font-semibold text-white">
                    Week of{' '}
                    {selectedWeek ? moment(selectedWeek.weekStart).format('MMMM D, YYYY') : ''}
                  </span>
                </p>
              </div>
            )}

            {selectedWeek && (
              <div
                key={selectedWeek.weekStart}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Week starting
                    </p>
                    <input
                      type="date"
                      value={selectedWeek.weekStart}
                      onChange={(e) =>
                        updateWeek(selectedWeekIdx, {
                          ...selectedWeek,
                          weekStart: e.target.value,
                        })
                      }
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <p className="text-sm text-white font-semibold">
                    {moment(selectedWeek.weekStart).format('MMMM D, YYYY')}
                  </p>
                </div>
                <div className="grid gap-3">
                  {selectedWeek.days.map((day, dayIndex) => (
                    <div
                      key={`${selectedWeek.weekStart}-${day.dayOfWeek}`}
                      className={`rounded-xl p-3 space-y-3 border transition ${
                        day.isEnabled
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-red-950 border-red-600/60 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">{day.dayOfWeek}</p>
                        <div className="flex items-center gap-2">
                          {!day.isEnabled && (
                            <span className="text-xs text-amber-200 uppercase tracking-wide">
                              hidden
                            </span>
                          )}
                          <Switch
                            checked={day.isEnabled}
                            onCheckedChange={(checked) =>
                              updateDay(selectedWeekIdx, dayIndex, { isEnabled: checked })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs text-gray-400 uppercase tracking-wide">
                            Start Time
                          </Label>
                          <select
                            value={day.startTime}
                            onChange={(e) =>
                              updateDay(selectedWeekIdx, dayIndex, { startTime: e.target.value })
                            }
                            className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white"
                          >
                            {timeOptions.map((option) => (
                              <option
                                key={`start-${selectedWeek.weekStart}-${day.dayOfWeek}-${option}`}
                                value={option}
                              >
                                {moment(option, 'HH:mm').format('hh:mm A')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-400 uppercase tracking-wide">
                            End Time
                          </Label>
                          <select
                            value={day.endTime}
                            onChange={(e) =>
                              updateDay(selectedWeekIdx, dayIndex, { endTime: e.target.value })
                            }
                            className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white"
                          >
                            {timeOptions.map((option) => (
                              <option
                                key={`end-${selectedWeek.weekStart}-${day.dayOfWeek}-${option}`}
                                value={option}
                              >
                                {moment(option, 'HH:mm').format('hh:mm A')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-400 uppercase tracking-wide">
                            Slot Duration
                          </Label>
                          <input
                            type="number"
                            min={10}
                            max={180}
                            value={day.slotDuration}
                            onChange={(e) =>
                              updateDay(selectedWeekIdx, dayIndex, {
                                slotDuration: Number(e.target.value) || defaultSlotDuration,
                              })
                            }
                            className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white"
                          />
                        </div>
                        <div className="flex items-end">
                          <Label className="text-xs text-gray-400 uppercase tracking-wide">
                            Enabled
                          </Label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">
                            Blocked Times
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addBlockedTime(selectedWeekIdx, dayIndex)}
                            disabled={!day.isEnabled}
                          >
                            Add block
                          </Button>
                        </div>
                        {day.blockedTimes.map((block, blockedIndex) => (
                          <div
                            key={`${selectedWeek.weekStart}-${day.dayOfWeek}-blocked-${blockedIndex}`}
                            className="flex flex-wrap gap-2 items-center"
                          >
                            <select
                              value={block.startTime}
                              onChange={(e) =>
                                updateBlockedTime(
                                  selectedWeekIdx,
                                  dayIndex,
                                  blockedIndex,
                                  'startTime',
                                  e.target.value,
                                )
                              }
                              className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white"
                            >
                              {timeOptions.map((option) => (
                                <option
                                  key={`block-start-${blockedIndex}-${option}`}
                                  value={option}
                                >
                                  {moment(option, 'HH:mm').format('hh:mm A')}
                                </option>
                              ))}
                            </select>
                            <select
                              value={block.endTime}
                              onChange={(e) =>
                                updateBlockedTime(
                                  selectedWeekIdx,
                                  dayIndex,
                                  blockedIndex,
                                  'endTime',
                                  e.target.value,
                                )
                              }
                              className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white"
                            >
                              {timeOptions.map((option) => (
                                <option
                                  key={`block-end-${blockedIndex}-${option}`}
                                  value={option}
                                >
                                  {moment(option, 'HH:mm').format('hh:mm A')}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                removeBlockedTime(selectedWeekIdx, dayIndex, blockedIndex)
                              }
                              className="text-gray-400"
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Remove blocked time</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
