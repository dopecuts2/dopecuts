// app/admin/about/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  IAbout,
  IBarber,
  getAbout,
  updateAbout,
  createBarber,
  updateBarber,
  deleteBarber,
} from '@/lib/api/about';


type AboutFormState = Omit<Partial<IAbout>, 'values'> & {
  values?: string | string[];
};

export default function AdminAboutPage() {
  const [about, setAbout] = useState<IAbout | null>(null);
  const [barbers, setBarbers] = useState<IBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barberSavingId, setBarberSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [aboutForm, setAboutForm] = useState<AboutFormState>({
    heroTitle: '',
    heroSubtitle: '',
    storyTitle: '',
    storyBody: '',
    mission: '',
    values: [],
  });

  const [barberForm, setBarberForm] = useState<{
    _id?: string;
    name: string;
    role: string;
    experience?: string;
    order?: number;
    isActive: boolean;
    imageFile?: File | null;
  }>({
    name: '',
    role: '',
    experience: '',
    order: 0,
    isActive: true,
    imageFile: null,
  });

  const sortedBarbers = useMemo(
    () => barbers.slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [barbers]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAbout();
      setAbout(data.about);
      setBarbers(data.barbers || []);
      setAboutForm({
        heroTitle: data.about.heroTitle,
        heroSubtitle: data.about.heroSubtitle,
        storyTitle: data.about.storyTitle,
        storyBody: data.about.storyBody,
        mission: data.about.mission,
        values: data.about.values,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load about page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAboutSave = async () => {
    try {
      setSaving(true);
      const values =
        typeof aboutForm.values === 'string'
          ? (aboutForm.values as any).split('\n').map((v: string) => v.trim()).filter(Boolean)
          : aboutForm.values;
      const payload: Partial<IAbout> = { ...aboutForm, values };
      const res = await updateAbout(payload);
      setAbout(res.about);
      toast.success('About content updated.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save About.');
    } finally {
      setSaving(false);
    }
  };

  const resetBarberForm = () => {
    setBarberForm({
      name: '',
      role: '',
      experience: '',
      order: 0,
      isActive: true,
      imageFile: null,
    });
    setBarberSavingId(null);
  };

  const handleBarberSubmit = async () => {
    if (!barberForm.name || !barberForm.role) {
      toast.error('Name and role are required.');
      return;
    }
    try {
      setBarberSavingId(barberForm._id || 'new');
      if (barberForm._id) {
        const res = await updateBarber(barberForm._id, {
          name: barberForm.name,
          role: barberForm.role,
          experience: barberForm.experience,
          order: barberForm.order,
          isActive: barberForm.isActive,
          image: barberForm.imageFile || undefined,
        });
        setBarbers((prev) => prev.map((b) => (b._id === res.barber._id ? res.barber : b)));
        toast.success('Barber updated.');
      } else {
        if (!barberForm.imageFile) {
          toast.error('Image is required for a new barber.');
          setBarberSavingId(null);
          return;
        }
        const res = await createBarber({
          name: barberForm.name,
          role: barberForm.role,
          experience: barberForm.experience,
          order: barberForm.order,
          isActive: barberForm.isActive,
          image: barberForm.imageFile,
        });
        setBarbers((prev) => [...prev, res.barber]);
        toast.success('Barber created.');
      }
      resetBarberForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save barber.');
    } finally {
      setBarberSavingId(null);
    }
  };

  const handleBarberDelete = async (id: string) => {
    if (!confirm('Delete this barber?')) return;
    try {
      setBarberSavingId(id);
      await deleteBarber(id);
      setBarbers((prev) => prev.filter((b) => b._id !== id));
      toast.success('Barber deleted.');
      if (barberForm._id === id) resetBarberForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Delete failed.');
    } finally {
      setBarberSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-300">Loading...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">About Page</h1>
          <p className="text-sm text-gray-400">Manage About content and barbers.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload
        </Button>
      </div>

      {/* About content */}
      <Card className="bg-gray-800 border border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">About Content</CardTitle>
          <CardDescription className="text-gray-300">
            Hero, story, mission, and values displayed on the About page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Hero Title</Label>
              <Input
                value={aboutForm.heroTitle || ''}
                onChange={(e) => setAboutForm((prev) => ({ ...prev, heroTitle: e.target.value }))}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Hero Subtitle</Label>
              <Input
                value={aboutForm.heroSubtitle || ''}
                onChange={(e) => setAboutForm((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Story Title</Label>
            <Input
              value={aboutForm.storyTitle || ''}
              onChange={(e) => setAboutForm((prev) => ({ ...prev, storyTitle: e.target.value }))}
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Story Body</Label>
            <Textarea
              value={aboutForm.storyBody || ''}
              onChange={(e) => setAboutForm((prev) => ({ ...prev, storyBody: e.target.value }))}
              rows={5}
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Mission</Label>
            <Textarea
              value={aboutForm.mission || ''}
              onChange={(e) => setAboutForm((prev) => ({ ...prev, mission: e.target.value }))}
              rows={3}
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Values (one per line)</Label>
            <Textarea
              value={
                Array.isArray(aboutForm.values)
                  ? (aboutForm.values as string[]).join('\n')
                  : aboutForm.values || ''
              }
              onChange={(e) => setAboutForm((prev) => ({ ...prev, values: e.target.value }))}
              rows={4}
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>
          <Button onClick={handleAboutSave} disabled={saving}>
            Save About Content
          </Button>
        </CardContent>
      </Card>

      {/* Barbers */}
      <Card className="bg-gray-800 border border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Barbers</CardTitle>
          <CardDescription className="text-gray-300">
            Add, edit, and reorder the “Meet our barbers” section.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Name</Label>
              <Input
                value={barberForm.name}
                onChange={(e) => setBarberForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Role</Label>
              <Input
                value={barberForm.role}
                onChange={(e) => setBarberForm((prev) => ({ ...prev, role: e.target.value }))}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Experience</Label>
              <Input
                value={barberForm.experience || ''}
                onChange={(e) => setBarberForm((prev) => ({ ...prev, experience: e.target.value }))}
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Order</Label>
              <Input
                type="number"
                value={barberForm.order ?? 0}
                onChange={(e) =>
                  setBarberForm((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))
                }
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Image</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setBarberForm((prev) => ({ ...prev, imageFile: file || null }));
                  }}
                  className="bg-gray-900 border-gray-700 text-white"
                />
                {barberForm._id && !barberForm.imageFile && (
                  <span className="text-xs text-gray-400">Keep existing</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={barberForm.isActive}
                onCheckedChange={(checked) => setBarberForm((prev) => ({ ...prev, isActive: checked }))}
              />
              <Label className="text-sm text-gray-300">Active</Label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {barberForm._id && (
              <Button variant="ghost" onClick={resetBarberForm} className="text-gray-300">
                Cancel Edit
              </Button>
            )}
            <Button onClick={handleBarberSubmit} disabled={!!barberSavingId}>
              <Plus className="h-4 w-4 mr-2" />
              {barberForm._id ? 'Update Barber' : 'Add Barber'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Existing Barbers</CardTitle>
          <CardDescription className="text-gray-300">
            Edit order, toggle visibility, or replace images.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedBarbers.length === 0 && <p className="text-sm text-gray-300">No barbers yet.</p>}
          {sortedBarbers.length > 0 && (
            <div className="space-y-3">
              {sortedBarbers.map((b) => (
                <div
                  key={b._id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-900 border border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                      <img src={b.image} alt={b.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-white font-semibold">
                        {b.name} • {b.role}
                      </p>
                      <p className="text-sm text-gray-300">{b.experience}</p>
                      <p className="text-xs text-gray-400">
                        Order: {b.order} • {b.isActive ? 'Active' : 'Hidden'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setBarberForm({
                          _id: b._id,
                          name: b.name,
                          role: b.role,
                          experience: b.experience,
                          order: b.order,
                          isActive: b.isActive,
                          imageFile: null,
                        })
                      }
                      disabled={!!barberSavingId}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-red-400"
                      onClick={() => void handleBarberDelete(b._id)}
                      disabled={barberSavingId === b._id}
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
