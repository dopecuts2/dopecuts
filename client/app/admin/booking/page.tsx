// dopekuts/app/admin/booking/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Search,
  CreditCard as Edit,
  X,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  PlusCircle,
  Pencil,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllBookings,
  confirmPayment,
  cancelBookingAdmin,
  updateBookingAdmin,
  IBooking,
  sendBookingMessage,
} from '@/lib/api/booking';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import BookAppointmentPage from '@/app/book/page';

/** ========== Date/Time helpers (no external libs) ========== */

// Format YYYY-MM for a Date (local)
function toYYYYMM(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

// Parse "YYYY-MM-DD" safely into a local Date at 00:00
function parseLocalDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

// Parse "h:mm A" into 24h {hours, minutes}, defaults to 0:0 if bad
function parseTime12hTo24h(timeStr?: string): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 0, minutes: 0 };
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return { hours: 0, minutes: 0 };
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

// Combine booking date ("YYYY-MM-DD") and time ("h:mm A") to a local Date
function toBookingDateTime(b: IBooking): Date {
  const dateOnly = parseLocalDateOnly(b.date);
  const { hours, minutes } = parseTime12hTo24h(b.time as unknown as string);
  return new Date(
    dateOnly.getFullYear(),
    dateOnly.getMonth(),
    dateOnly.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

// Compare only the date part (ignores time)
function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Set to start of local day
function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// End of month for year & month (local)
function endOfMonthLocal(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999);
}

// Inclusive check for date-only range (compare by date parts)
function isOnOrAfterDate(a: Date, fromInclusive: Date) {
  const A = startOfLocalDay(a);
  const F = startOfLocalDay(fromInclusive);
  return A.getTime() >= F.getTime();
}
function isOnOrBeforeDate(a: Date, toInclusive: Date) {
  const A = startOfLocalDay(a);
  const T = startOfLocalDay(toInclusive);
  return A.getTime() <= T.getTime();
}

// Add days (date-only)
function addDaysLocal(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Human formatting respecting user locale
const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

/** =========================================================== */

export default function BookingManagement() {
  // State
  const [bookings, setBookings] = useState<IBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create booking modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    type: 'cancel' | 'reschedule' | null;
    booking: IBooking | null;
  }>({ open: false, type: null, booking: null });

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalBooking, setNoteModalBooking] = useState<IBooking | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [messageModal, setMessageModal] = useState<{ open: boolean; booking: IBooking | null; message: string }>({
    open: false,
    booking: null,
    message: '',
  });
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Filters & sort
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'time' | 'customer' | 'service'>('date');

  // Default to current month in user's local time
  const [monthFilter, setMonthFilter] = useState(toYYYYMM(new Date()));

  // Fetch
  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const fetchedBookings = await getAllBookings();
      setBookings(fetchedBookings || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setError('Could not load booking data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleModalOpenChange = (open: boolean) => {
    setIsCreateModalOpen(open);
    if (!open) fetchBookings();
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <X className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Actions
  const handleConfirmBooking = async (bookingId: string) => {
    try {
      const { booking: updatedBooking } = await confirmPayment(bookingId);
      setBookings((prev) =>
        prev.map((b) => (b._id === bookingId ? { ...b, status: updatedBooking.status } : b))
      );
    } catch (err) {
      console.error('Failed to confirm booking:', err);
      toast.error('Could not confirm the booking.');
    }
  };

  const openActionModal = (type: 'cancel' | 'reschedule', booking: IBooking) => {
    setActionModal({ open: true, type, booking });
  };

  const closeActionModal = () => {
    setActionModal({ open: false, type: null, booking: null });
  };

  const handleCancelBooking = (booking: IBooking) => {
    openActionModal('cancel', booking);
  };

  const handleReschedule = (booking: IBooking) => {
    openActionModal('reschedule', booking);
  };

  const handleConfirmCancel = async () => {
    if (!actionModal.booking) return;
    setIsActionProcessing(true);
    try {
      await cancelBookingAdmin(actionModal.booking._id);
      setBookings((prev) =>
        prev.map((b) =>
          b._id === actionModal.booking!._id
            ? { ...b, status: 'cancelled' as const }
            : b
        )
      );
      toast.success('Booking cancelled.');
      closeActionModal();
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      toast.error('Could not cancel the booking.');
    } finally {
      setIsActionProcessing(false);
    }
  };

  const openNoteEditor = (booking: IBooking) => {
    setNoteModalBooking(booking);
    setNoteDraft(booking.cancellationNote ?? '');
    setNoteModalOpen(true);
  };

  const handleSaveNote = async () => {
    if (!noteModalBooking) return;
    setIsSavingNote(true);
    try {
      const payload = {
        cancellationNote: noteDraft.trim() || undefined,
      };
      const { booking: updatedBooking } = await updateBookingAdmin(noteModalBooking._id, payload);
      setBookings((prev) =>
        prev.map((b) => (b._id === updatedBooking._id ? updatedBooking : b))
      );
      toast.success('Cancellation note saved.');
      setNoteModalOpen(false);
    } catch (error) {
      console.error('Failed to save cancellation note:', error);
      toast.error('Unable to save the cancellation note.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const openMessageModal = (booking: IBooking) => {
    setMessageModal({ open: true, booking, message: '' });
  };

  const handleSendMessage = async () => {
    if (!messageModal.booking) return;
    const body = messageModal.message.trim();
    if (!body) {
      toast.error('Enter a message to send.');
      return;
    }
    setIsSendingMessage(true);
    try {
      await sendBookingMessage(messageModal.booking._id, body);
      toast.success('Message sent.');
      setMessageModal({ open: false, booking: null, message: '' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to send message.';
      toast.error(msg);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Available months from data + ensure current month is present
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    for (const b of bookings) {
      const d = parseLocalDateOnly(b.date);
      monthSet.add(toYYYYMM(d));
    }
    monthSet.add(toYYYYMM(new Date()));
    return Array.from(monthSet).sort().reverse(); // newest first
  }, [bookings]);

  // Filter + sort (native Date, local TZ)
  const filteredAndSortedBookings = (() => {
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const [selY, selM] = monthFilter !== 'all' ? monthFilter.split('-').map((v) => parseInt(v, 10)) : [NaN, NaN];
    const isMonthSelected = monthFilter !== 'all';
    const isCurrentMonthSelected =
      isMonthSelected &&
      selY === now.getFullYear() &&
      (selM - 1) === now.getMonth();

    const monthStart = isMonthSelected ? new Date(selY, (selM || 1) - 1, 1, 0, 0, 0, 0) : null;
    const monthEnd = isMonthSelected ? endOfMonthLocal(selY!, (selM! - 1)) : null;

    let filtered = bookings.filter((booking) => {
      const bookingDT = toBookingDateTime(booking);
      const bookingDateOnly = startOfLocalDay(bookingDT);

      // search
      const customerFullName = `${booking.firstName} ${booking.lastName}`.toLowerCase();
      const matchesSearch =
        customerFullName.includes(searchTerm.toLowerCase()) ||
        (booking.phone || '').includes(searchTerm) ||
        (booking.service || '').toLowerCase().includes(searchTerm.toLowerCase());

      // status
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

      // date/month logic
      let matchesDate = true;
      if (isMonthSelected && monthStart && monthEnd) {
        if (isCurrentMonthSelected) {
          // Current month: show from TODAY (date-only) to end of month, inclusive
          matchesDate =
            isOnOrAfterDate(bookingDateOnly, todayStart) && isOnOrBeforeDate(bookingDateOnly, monthEnd);
        } else {
          // Other month: show full month, inclusive
          matchesDate =
            isOnOrAfterDate(bookingDateOnly, monthStart) && isOnOrBeforeDate(bookingDateOnly, monthEnd);
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });

    // Sort: by date ascending, then time ascending (always deterministic)
    filtered.sort((a, b) => {
      const aDT = toBookingDateTime(a);
      const bDT = toBookingDateTime(b);

      if (sortBy === 'customer') {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
      if (sortBy === 'service') {
        return (a.service || '').localeCompare(b.service || '');
      }
      if (sortBy === 'time') {
        // Only compare time (same day ordering will follow time)
        const aT = parseTime12hTo24h(a.time as unknown as string);
        const bT = parseTime12hTo24h(b.time as unknown as string);
        if (aT.hours !== bT.hours) return aT.hours - bT.hours;
        if (aT.minutes !== bT.minutes) return aT.minutes - bT.minutes;
        // tie-breaker by date
        return aDT.getTime() - bDT.getTime();
      }

      // Default: 'date' — by full datetime ascending
      const cmp = aDT.getTime() - bDT.getTime();
      if (cmp !== 0) return cmp;

      // Stabilize sort: customer then service
      const nameCmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (nameCmp !== 0) return nameCmp;
      return (a.service || '').localeCompare(b.service || '');
    });

    return filtered;
  })();

  // Dashboard numbers (native)
  const todayBookings = bookings.filter((b) => {
    const dt = toBookingDateTime(b);
    return isSameLocalDay(dt, new Date());
  });

  const upcomingBookings = bookings.filter((b) => {
    const dt = startOfLocalDay(toBookingDateTime(b));
    const today = startOfLocalDay(new Date());
    const in7Days = addDaysLocal(today, 7);
    return isOnOrAfterDate(dt, today) && isOnOrBeforeDate(dt, in7Days);
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Booking Management</h1>
        <p className="text-sm md:text-base text-gray-400">View and manage customer appointments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300">Today's Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{todayBookings.length}</div>
            <p className="text-sm text-gray-400">
              {todayBookings.filter((b) => b.status === 'confirmed').length} confirmed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{upcomingBookings.length}</div>
            <p className="text-sm text-gray-400">Next 7 days</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300">Revenue Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              $
              {todayBookings.reduce(
                (sum, booking) => (booking.status === 'confirmed' ? sum + booking.price : sum),
                0
              )}
            </div>
            <p className="text-sm text-gray-400">From confirmed</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={handleModalOpenChange}>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle className="text-white">Manage Bookings</CardTitle>
                <CardDescription className="text-gray-300">
                  View and manage customer appointments
                </CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button className="bg-white text-black hover:bg-gray-200 w-full sm:w-auto">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Booking
                </Button>
              </DialogTrigger>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, phone, or service..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Month Filter</label>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                  >
                    <option value="all">All Months</option>
                    {availableMonths.map((month) => {
                      const [y, m] = month.split('-').map((v) => parseInt(v, 10));
                      const temp = new Date(y, (m || 1) - 1, 1);
                      const label = temp.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                      return (
                        <option key={month} value={month}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as 'all' | 'confirmed' | 'pending' | 'cancelled')
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'date' | 'time' | 'customer' | 'service')
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                  >
                    <option value="date">Date</option>
                    <option value="time">Time</option>
                    <option value="customer">Customer Name</option>
                    <option value="service">Service Type</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 mb-2">
              <p className="text-sm text-gray-400">
                Showing {filteredAndSortedBookings.length} booking
                {filteredAndSortedBookings.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Bookings List */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-12 text-gray-400">Loading bookings...</div>
              ) : error ? (
                <div className="text-center py-12 text-red-400">{error}</div>
              ) : filteredAndSortedBookings.length === 0 ? (
                <div className="text-center py-8 md:py-12 text-gray-400">
                  <Calendar className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm md:text-base">No bookings found for the selected criteria</p>
                </div>
              ) : (
                filteredAndSortedBookings.map((booking) => {
                  const dt = toBookingDateTime(booking);
                  const isPastBooking = Date.now() > dt.getTime();

                  return (
                    <div
                      key={booking._id}
                      className="bg-gray-700 border border-gray-600 rounded-lg p-3 sm:p-4 lg:p-6"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Booking Info */}
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 md:mb-3">
                            <h3 className="text-base md:text-lg font-semibold text-white">
                              {booking.firstName} {booking.lastName}
                            </h3>
                            {getStatusBadge(booking.status)}
                            {isPastBooking && (
                              <Badge className="bg-gray-500 text-white border-gray-400">Past booking</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 text-xs sm:text-sm">
                            <div className="flex items-center text-gray-300">
                              <User className="h-4 w-4 mr-2" />
                              {booking.service}
                            </div>
                            <div className="flex items-center text-gray-300">
                              <Calendar className="h-4 w-4 mr-2" />
                              {dateFmt.format(dt)}
                            </div>
                            <div className="flex items-center text-gray-300">
                              <Clock className="h-4 w-4 mr-2" />
                              {dt.toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}{' '}
                              ({booking.duration}min)
                            </div>
                            <div className="flex items-center text-gray-300 gap-2">
                              <Phone className="h-4 w-4" />
                              <span className="truncate">{booking.phone}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-blue-300 bg-blue-700 hover:text-white hover:bg-blue-700/50"
                                onClick={() => openMessageModal(booking)}
                                title="Send message"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {booking.notes && (
                            <div className="mt-2 md:mt-3 p-2 md:p-3 bg-gray-800 rounded-md">
                              <p className="text-xs sm:text-sm text-gray-300">
                                <strong>Notes:</strong> {booking.notes}
                              </p>
                            </div>
                          )}
                          {booking.status === 'cancelled' && (
                            <div className="mt-2 md:mt-3 p-2 md:p-3 bg-red-900/40 rounded-md border border-red-600">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs sm:text-sm text-red-200 font-medium">
                                  Cancellation Note
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openNoteEditor(booking)}
                                  className="text-red-100 hover:bg-red-800/60"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit note</span>
                                </Button>
                              </div>
                              <p className="text-xs sm:text-sm text-red-100 mt-1">
                                {booking.cancellationNote || 'Add any details staff should know about this cancellation.'}
                              </p>
                            </div>
                          )}
                          {booking.additionalGuests && booking.additionalGuests.length > 0 && (
                            <div className="mt-2 md:mt-3 p-2 md:p-3 bg-gray-800 rounded-md border border-gray-600">
                              <p className="text-xs sm:text-sm text-gray-100">
                                <strong>Additional Guest{booking.additionalGuests.length > 1 ? 's' : ''}:</strong>{' '}
                                {booking.additionalGuests.map((guest) => `${guest.firstName} ${guest.lastName}`).join('; ')}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 lg:w-36 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-600 lg:pl-4">
                          {!isPastBooking ? (
                            <>
                              {booking.status === 'pending' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleConfirmBooking(booking._id)}
                                  className="bg-green-600 hover:bg-green-700 text-white w-full"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Confirm
                                </Button>
                              )}

                              {booking.status !== 'cancelled' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReschedule(booking)}
                                    className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white w-full"
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Reschedule
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCancelBooking(booking)}
                                    className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white w-full"
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                </>
                              )}

                              {booking.status === 'cancelled' && (
                                <Badge variant="secondary" className="text-center py-2">
                                  No Actions
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="secondary" className="text-center py-2">
                              No Actions (past)
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <DialogContent className="p-0 border-none max-w-5xl w-full h-[90vh] bg-transparent">
          <div className="overflow-y-auto w-full h-full rounded-lg">
            <BookAppointmentPage />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionModal.open} onOpenChange={(open) => !open && closeActionModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionModal.type === 'cancel'
                ? 'Confirm cancellation'
                : 'Reschedule booking'}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const booking = actionModal.booking;
                if (actionModal.type === 'cancel') {
                  return booking
                    ? `This will cancel ${booking.firstName} ${booking.lastName} on ${dateFmt.format(
                        toBookingDateTime(booking)
                      )} at ${booking.time}.`
                    : 'This will cancel the selected booking.';
                }
                return booking
                  ? `Rescheduling ${booking.firstName} ${booking.lastName} is coming soon.`
                  : 'Rescheduling is coming soon.';
              })()}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={closeActionModal}
              disabled={isActionProcessing}
            >
              {actionModal.type === 'cancel' ? 'Keep booking' : 'Close'}
            </Button>
            {actionModal.type === 'cancel' ? (
              <Button onClick={handleConfirmCancel} disabled={isActionProcessing}>
                {isActionProcessing ? 'Cancelling...' : 'Cancel booking'}
              </Button>
            ) : (
              <Button onClick={closeActionModal}>Ok</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancellation note</DialogTitle>
            <DialogDescription>
              Add a short message describing why the customer cancelled. Only staff see this.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-white min-h-[120px]"
            placeholder="Enter any context you want other staff to see..."
          />

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setNoteModalOpen(false)}
              disabled={isSavingNote}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={isSavingNote}>
              {isSavingNote ? 'Saving...' : 'Save note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={messageModal.open}
        onOpenChange={(open) => {
          if (!open) setMessageModal({ open: false, booking: null, message: '' });
        }}
      >
        <DialogContent className="bg-gray-900 text-white border border-gray-700">
          <DialogHeader>
            <DialogTitle>Send message</DialogTitle>
            <DialogDescription>
              {messageModal.booking
                ? `Send a quick SMS to ${messageModal.booking.firstName} ${messageModal.booking.lastName} (${messageModal.booking.phone}).`
                : 'Send a quick message to this customer.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={messageModal.message}
            onChange={(e) => setMessageModal((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Type your message..."
            className="min-h-[120px] bg-gray-800 border border-gray-700 text-white"
          />
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setMessageModal({ open: false, booking: null, message: '' })}
              disabled={isSendingMessage}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={isSendingMessage}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isSendingMessage ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
