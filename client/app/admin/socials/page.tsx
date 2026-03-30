// app/admin/socials/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  ISocial,
  SocialPlatform,
  createSocial,
  deleteSocial,
  getAllSocials,
  updateSocial,
} from '@/lib/api/socials';

const topPlatforms: SocialPlatform[] = [
  'instagram',
  'facebook',
  'twitter',
  'tiktok',
  'snapchat',
  'linkedin',
  'youtube',
  'pinterest',
  'whatsapp',
  'telegram',
];

const platformLabels: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

export default function AdminSocialsPage() {
  const [socials, setSocials] = useState<ISocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<Partial<ISocial>>({
    platform: 'instagram',
    label: 'Instagram',
    url: '',
    order: 0,
    isActive: true,
  });

  const sortedSocials = useMemo(
    () => socials.slice().sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    [socials]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllSocials();
      setSocials(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load socials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setForm({
      platform: 'instagram',
      label: 'Instagram',
      url: '',
      order: 0,
      isActive: true,
    });
    setSavingId(null);
  };

  const handleSubmit = async () => {
    if (!form.platform || !form.label || !form.url) {
      toast.error('Platform, label, and URL are required.');
      return;
    }
    const payload: Partial<ISocial> = {
      platform: form.platform,
      label: form.label,
      url: form.url,
      order: Number(form.order) || 0,
      isActive: form.isActive ?? true,
    };
    try {
      setSavingId(form._id ? form._id : 'new');
      if (form._id) {
        const res = await updateSocial(form._id, payload);
        setSocials((prev) => prev.map((s) => (s._id === form._id ? res.social : s)));
        toast.success('Social updated');
      } else {
        const res = await createSocial(payload);
        setSocials((prev) => [...prev, res.social]);
        toast.success('Social created');
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const handleEdit = (s: ISocial) => {
    setForm(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this social link?')) return;
    try {
      setSavingId(id);
      await deleteSocial(id);
      setSocials((prev) => prev.filter((s) => s._id !== id));
      toast.success('Social deleted');
      if (form._id === id) resetForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Delete failed');
    } finally {
      setSavingId(null);
    }
  };

  const handlePlatformChange = (platform: SocialPlatform) => {
    setForm((prev) => ({
      ...prev,
      platform,
      label: platformLabels[platform] || prev.label,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Social Links</h1>
          <p className="text-sm text-gray-400">Manage icons and links shown across the site.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </Button>
      </div>

      <Card className="bg-gray-800 border border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Add / Edit Social</CardTitle>
          <CardDescription className="text-gray-300">
            Choose a platform, set label, URL, order, and activation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Platform</Label>
              <select
                value={form.platform}
                onChange={(e) => handlePlatformChange(e.target.value as SocialPlatform)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
              >
                {topPlatforms.map((p) => (
                  <option key={p} value={p}>
                    {platformLabels[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Label</Label>
              <Input
                value={form.label || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Display name"
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">URL</Label>
              <Input
                value={form.url || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://"
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Order</Label>
              <Input
                type="number"
                value={form.order ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, order: Number(e.target.value) }))}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive ?? true}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
              />
              <Label className="text-sm text-gray-300">Active</Label>
            </div>
            <div className="flex items-center gap-3">
              {form._id && (
                <Button variant="ghost" onClick={resetForm} className="text-gray-300">
                  Cancel Edit
                </Button>
              )}
              <Button onClick={handleSubmit} disabled={!!savingId}>
                <Plus className="h-4 w-4 mr-2" />
                {form._id ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Existing Socials</CardTitle>
          <CardDescription className="text-gray-300">Edit, toggle, or delete entries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-gray-300">Loading socials…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!loading && !error && sortedSocials.length === 0 && (
            <p className="text-sm text-gray-300">No socials yet.</p>
          )}
          {!loading && !error && sortedSocials.length > 0 && (
            <div className="space-y-3">
              {sortedSocials.map((s) => (
                <div
                  key={s._id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-900 border border-gray-700 rounded-lg p-4"
                >
                  <div className="space-y-1">
                    <p className="text-white font-semibold">
                      {platformLabels[s.platform] || s.platform} • {s.label}
                    </p>
                    <p className="text-sm text-blue-300 break-all">{s.url}</p>
                    <p className="text-xs text-gray-400">
                      Order: {s.order} • {s.isActive ? 'Active' : 'Hidden'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => handleEdit(s)} disabled={!!savingId}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-red-400"
                      onClick={() => void handleDelete(s._id)}
                      disabled={savingId === s._id}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
