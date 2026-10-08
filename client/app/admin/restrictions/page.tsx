// app/admin/restrictions/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldBan, CreditCard, Trash2 } from 'lucide-react';
import moment from 'moment';
import { toast } from 'sonner';
import {
  getCustomerRestrictions,
  upsertCustomerRestriction,
  deleteCustomerRestriction,
  type ICustomerRestriction,
  type RestrictionStatus,
} from '@/lib/api/customerRestrictions';

export default function RestrictionsManagement() {
  const [restrictions, setRestrictions] = useState<ICustomerRestriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<RestrictionStatus>('pay_now_required');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomerRestrictions();
      setRestrictions(data);
    } catch (err) {
      console.error('Failed to load restrictions:', err);
      setError('Could not load restrictions. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!phone.trim()) {
      toast.error('Enter a phone number.');
      return;
    }
    setSaving(true);
    try {
      await upsertCustomerRestriction({ phone: phone.trim(), status, reason: reason.trim() || undefined });
      toast.success('Restriction saved.');
      setPhone('');
      setReason('');
      setStatus('pay_now_required');
      await load();
    } catch (err) {
      console.error('Failed to save restriction:', err);
      toast.error('Failed to save restriction.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (restriction: ICustomerRestriction) => {
    if (!window.confirm(`Remove the restriction on ${restriction.phone}? They'll be able to book normally again.`)) {
      return;
    }
    setRemovingId(restriction._id);
    try {
      await deleteCustomerRestriction(restriction._id);
      toast.success('Restriction removed.');
      setRestrictions((prev) => prev.filter((r) => r._id !== restriction._id));
    } catch (err) {
      console.error('Failed to remove restriction:', err);
      toast.error('Failed to remove restriction.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Restrictions</h1>
        <p className="text-sm md:text-base text-gray-400">
          Manage phone numbers that require prepayment or are blocked from booking entirely.
        </p>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Add or Update a Restriction</CardTitle>
          <CardDescription className="text-gray-300">
            Numbers with 3+ cancellations are added here automatically (Pay Now Required). You can
            also add one yourself, or ban a number from booking entirely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white font-medium">Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (416) 555-1234"
                className="mt-2 bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-white font-medium">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RestrictionStatus)}
                className="mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="pay_now_required">Pay Now Required</option>
                <option value="banned">Banned (blocked entirely)</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-white font-medium">Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Repeated no-shows"
              className="mt-2 bg-gray-900 border-gray-700 text-white"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-white text-black hover:bg-gray-200">
            {saving ? 'Saving...' : 'Save Restriction'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Current Restrictions</CardTitle>
          <CardDescription className="text-gray-300">
            {restrictions.length} number{restrictions.length === 1 ? '' : 's'} currently restricted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : restrictions.length === 0 ? (
            <p className="text-sm text-gray-400">No restricted numbers.</p>
          ) : (
            <div className="space-y-3">
              {restrictions.map((r) => (
                <div
                  key={r._id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gray-900 border border-gray-700 rounded-lg p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {r.status === 'banned' ? (
                        <ShieldBan className="h-4 w-4 text-red-400" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-amber-400" />
                      )}
                      <p className="text-white font-semibold">{r.phone}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.status === 'banned'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status === 'banned' ? 'Banned' : 'Pay Now Required'}
                      </span>
                    </div>
                    {r.reason && <p className="text-sm text-gray-400">{r.reason}</p>}
                    <p className="text-xs text-gray-500">
                      Added {moment(r.createdAt).format('MMM D, YYYY h:mm A')}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={removingId === r._id}
                    onClick={() => handleRemove(r)}
                    className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {removingId === r._id ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
