'use client';

import { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  adminListQueue,
  adminUpdateQueueStatus,
  adminConvertQueueEntry,
  type IQueueEntry,
  type QueueStatus,
} from '@/lib/api/queue';
import { getAllServices, type IService } from '@/lib/api/service';
import { getAvailability } from '@/lib/api/calendar';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const statusLabels: Record<QueueStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  expired: 'Expired',
};

export default function AdminQueuePage() {
  const [entries, setEntries] = useState<IQueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<IService[]>([]);
  const [convertModal, setConvertModal] = useState<{ open: boolean; entry: IQueueEntry | null }>({
    open: false,
    entry: null,
  });
  const [convertTime, setConvertTime] = useState('');
  const [convertServiceId, setConvertServiceId] = useState<string>('');
  const [convertTimeOptions, setConvertTimeOptions] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [filters, setFilters] = useState<{ date?: string; status?: QueueStatus; serviceId?: string }>({
    date: moment().format('YYYY-MM-DD'),
    status: 'pending',
  });

  const statusIcon = (status: QueueStatus) => {
    if (status === 'pending') return <Clock className="w-4 h-4 text-amber-400" />;
    if (status === 'assigned') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    return <XCircle className="w-4 h-4 text-rose-400" />;
  };

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminListQueue(filters);
      setEntries(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load queue entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAllServices().then(setServices).catch(() => {});
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.date, filters.status, filters.serviceId]);

  const onUpdateStatus = async (id: string, status: QueueStatus) => {
    try {
      await adminUpdateQueueStatus(id, status);
      toast.success('Queue entry updated.');
      setEntries((prev) =>
        prev.map((e) => (e._id === id ? { ...e, status } : e))
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update entry.');
    }
  };

  const handleConvert = async () => {
    if (!convertModal.entry || !convertTime) return;
    try {
      await adminConvertQueueEntry(convertModal.entry._id, convertTime, convertServiceId || convertModal.entry.serviceId);
      toast.success('Queue entry converted to booking.');
      setConvertModal({ open: false, entry: null });
      setConvertTime('');
      setConvertServiceId('');
      setConvertTimeOptions([]);
      void load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to convert entry.');
    }
  };

  const filteredServices = useMemo(
    () => services.map((s) => ({ id: s._id, name: s.name })),
    [services]
  );

  const loadTimesForConversion = async (entry: IQueueEntry, serviceId: string) => {
    if (!entry.requestedDate) return;
    setLoadingTimes(true);
    setConvertTimeOptions([]);
    try {
      const slots = await getAvailability(entry.requestedDate, { serviceId });
      setConvertTimeOptions(slots);
      if (slots.length > 0) {
        setConvertTime(slots[0]);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load times.');
      const fallback = entry.desiredTime ? [entry.desiredTime] : [];
      setConvertTimeOptions(fallback);
      setConvertTime(fallback[0] || '');
    } finally {
      setLoadingTimes(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-gray-200">Date</Label>
              <Input
                type="date"
                value={filters.date || ''}
                onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value || undefined }))}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-200">Status</Label>
              <Select
                value={filters.status || 'pending'}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v as QueueStatus }))}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 text-white border-gray-700">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-200">Service</Label>
              <Select
                value={filters.serviceId || 'all'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, serviceId: v === 'all' ? undefined : v }))
                }
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="All services" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 text-white border-gray-700">
                  <SelectItem value="all">All services</SelectItem>
                  {filteredServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={load} disabled={loading} className="bg-white text-black">
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Queue Entries</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {entries.length === 0 ? (
            <p className="text-gray-400 text-sm">No queue entries found for the selected filters.</p>
          ) : (
            <table className="min-w-full text-sm text-gray-200">
              <thead>
                <tr className="text-left border-b border-gray-700">
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Date / Time</th>
                  <th className="py-2 pr-4">Payment</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry._id} className="border-b border-gray-800">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-white">
                        {entry.firstName} {entry.lastName || ''}
                      </div>
                      <div className="text-xs text-gray-400">{entry.phone}</div>
                      {entry.email && <div className="text-xs text-gray-400">{entry.email}</div>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-white">{entry.serviceName}</div>
                      {entry.additionalGuests?.length ? (
                        <div className="text-xs text-gray-400">
                          +{entry.additionalGuests.length} guest{entry.additionalGuests.length > 1 ? 's' : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">
                      <div>{moment(entry.requestedDate).format('MMM D')}</div>
                      <div className="text-xs text-gray-400">
                        {entry.preferAnytime ? 'Anytime' : entry.desiredTime || 'Time not set'}
                      </div>
                    </td>
                    <td className="py-3 pr-4 capitalize">{entry.preferredPaymentMethod.replace('-', ' ')}</td>
                    <td className="py-3 pr-4 flex items-center gap-2">
                      {statusIcon(entry.status)}
                      <span>{statusLabels[entry.status]}</span>
                    </td>
                    <td className="py-3 pr-4 space-x-2">
                      {entry.status !== 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onUpdateStatus(entry._id, 'pending')}
                        >
                          Mark Pending
                        </Button>
                      )}
                      {entry.status !== 'assigned' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onUpdateStatus(entry._id, 'assigned')}
                        >
                          Mark Assigned
                        </Button>
                      )}
                      {entry.status !== 'expired' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onUpdateStatus(entry._id, 'expired')}
                        >
                          Expire
                        </Button>
                      )}
                      {entry.status !== 'assigned' && (
                        <Dialog
                          open={convertModal.open && convertModal.entry?._id === entry._id}
                          onOpenChange={(open) => {
                            setConvertModal({ open, entry: open ? entry : null });
                            setConvertTime('');
                            setConvertServiceId(entry.serviceId);
                            if (open && entry.serviceId) {
                              void loadTimesForConversion(entry, entry.serviceId);
                            } else {
                              setConvertTimeOptions([]);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm">
                              Convert
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-gray-900 border border-gray-700">
                            <DialogHeader>
                              <DialogTitle className="text-white">Convert to booking</DialogTitle>
                              <DialogDescription className="text-gray-300">
                                Create a booking for this queue entry at the chosen time.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label className="text-gray-200">Service</Label>
                                <Select
                                  value={convertServiceId || entry.serviceId}
                                  onValueChange={(v) => {
                                    setConvertServiceId(v);
                                    setConvertTime('');
                                    void loadTimesForConversion(entry, v);
                                  }}
                                >
                                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                                    <SelectValue placeholder="Select service" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-900 text-white border-gray-700">
                                    {services.map((svc) => (
                                      <SelectItem key={`convert-svc-${svc._id}`} value={svc._id}>
                                        {svc.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-gray-200">Time</Label>
                                <Select value={convertTime} onValueChange={(v) => setConvertTime(v)}>
                                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                                    <SelectValue placeholder={loadingTimes ? 'Loading times...' : 'Select time'} />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-900 text-white border-gray-700">
                                    {convertTimeOptions.length === 0 && !loadingTimes ? (
                                      <SelectItem value="no-times" disabled>
                                        No available times
                                      </SelectItem>
                                    ) : (
                                      convertTimeOptions.map((t) => (
                                        <SelectItem key={`convert-time-${t}`} value={t}>
                                          {t}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="ghost" onClick={() => setConvertModal({ open: false, entry: null })}>
                                Cancel
                              </Button>
                              <Button onClick={handleConvert} disabled={!convertTime}>
                                Convert
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
