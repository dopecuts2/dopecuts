// app/admin/gallery/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  IGallery,
  getAllGalleryItems,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
} from '@/lib/api/gallery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getAllServices, IService } from '@/lib/api/service';

export default function AdminGalleryPage() {
  const [items, setItems] = useState<IGallery[]>([]);
  const [services, setServices] = useState<IService[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IGallery | null>(null);

  const [serviceId, setServiceId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const selectedServiceName = useMemo(
    () => services.find((s) => s._id === serviceId)?.name || '',
    [services, serviceId]
  );

  useEffect(() => {
    fetchGalleryItems();
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const svc = await getAllServices();
      setServices(svc);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    }
  };

  // Revoke any blob: URL when component unmounts or when preview changes
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const fetchGalleryItems = async () => {
    try {
      setLoading(true);
      const data = await getAllGalleryItems();
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching gallery items:', error);
      toast.error('Failed to load gallery items');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);

    // Clean up previous object URL
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview('');
    }
  };

  const handleAdd = async () => {
    if (!imageFile || !serviceId) {
      toast.error('Please provide a service and an image file');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('serviceId', serviceId);
      formData.append('image', imageFile);

      await createGalleryItem(formData);

      toast.success('Gallery item added successfully');
      setIsAddDialogOpen(false);
      setServiceId('');
      setImageFile(null);
      setImagePreview('');
      fetchGalleryItems();
    } catch (error) {
      console.error('Error adding gallery item:', error);
      toast.error('Failed to add gallery item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedItem || !serviceId) {
      toast.error('Please select a service');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      if (serviceId) formData.append('serviceId', serviceId);
      if (imageFile) formData.append('image', imageFile);

      await updateGalleryItem(selectedItem._id, formData);

      toast.success('Gallery item updated successfully');
      setIsEditDialogOpen(false);
      setSelectedItem(null);
      setServiceId('');
      setImageFile(null);
      setImagePreview('');
      fetchGalleryItems();
    } catch (error) {
      console.error('Error updating gallery item:', error);
      toast.error('Failed to update gallery item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      setSubmitting(true);
      await deleteGalleryItem(selectedItem._id);

      toast.success('Gallery item deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
      fetchGalleryItems();
    } catch (error) {
      console.error('Error deleting gallery item:', error);
      toast.error('Failed to delete gallery item');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (item: IGallery) => {
    setSelectedItem(item);
    setServiceId(item.serviceId || '');
    setImageFile(null);
    setImagePreview(item.image); // existing image URL
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (item: IGallery) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const openAddDialog = () => {
    setServiceId('');
    setImageFile(null);
    setImagePreview('');
    setIsAddDialogOpen(true);
  };

  return (
    <section className="relative min-h-screen text-white overflow-hidden">
      {/* Background from BookingCTA */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-950"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-white/5" aria-hidden="true" />

      <div className="relative z-10">
        <div className="container mx-auto py-10 px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Gallery Management</h1>
              <p className="text-gray-300 mt-2">Manage your barbershop gallery items</p>
            </div>
            <Button
              onClick={openAddDialog}
              size="lg"
              className="bg-black text-white hover:bg-black/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Gallery Item
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card
                  key={i}
                  className="overflow-hidden border-white/10 bg-white/5 backdrop-blur"
                >
                  <CardContent className="p-0">
                    <div className="aspect-square bg-white/10 animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="border-white/10 bg-white/5 backdrop-blur text-white">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ImageIcon className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No gallery items yet</h3>
                <p className="text-gray-300 mb-6">Start by adding your first gallery item</p>
                <Button
                  onClick={openAddDialog}
                  className="bg-black text-white hover:bg-black/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Gallery Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <Card
                  key={item._id}
                  className="overflow-hidden hover:shadow-lg transition-shadow border-white/10 bg-white/5 backdrop-blur text-white"
                >
                  <CardContent className="p-0">
                    <div className="aspect-square relative bg-black/30">
                      <img
                        src={item.image}
                        alt={item.category}
                        className="w-full h-full object-cover"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-1">{item.category}</h3>
                    <p className="text-sm text-gray-300 mb-1">
                      {item.serviceName}
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-white/20 text-white hover:bg-white/10"
                          onClick={() => openEditDialog(item)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 bg-red-600 text-white hover:bg-red-700"
                          onClick={() => openDeleteDialog(item)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="bg-gray-900 text-white border border-white/10">
              <DialogHeader>
                <DialogTitle>Add Gallery Item</DialogTitle>
                <DialogDescription className="text-gray-300">
                  Add a new item to your gallery. Choose a service and upload an image.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="add-service" className="text-gray-200">Service Category</Label>
                  <select
                    id="add-service"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select a service</option>
                    {services.map((svc) => (
                      <option key={svc._id} value={svc._id}>
                        {svc.name}
                      </option>
                    ))}
                  </select>
                </div>


                <div className="space-y-2">
                  <Label htmlFor="add-image" className="text-gray-200">Image File</Label>
                  <Input
                    id="add-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="bg-white/5 border-white/10 text-white file:text-white file:bg-transparent file:border-0"
                  />
                </div>

                {imagePreview && (
                  <div className="w-40 h-40 bg-white/5 rounded-lg overflow-hidden mx-auto">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={submitting}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={submitting}
                  className="bg-black text-white hover:bg-black/90"
                >
                  {submitting ? 'Adding...' : 'Add Item'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="bg-gray-900 text-white border border-white/10">
              <DialogHeader>
                <DialogTitle>Edit Gallery Item</DialogTitle>
                <DialogDescription className="text-gray-300">
                  Update the service category. You can optionally upload a new image to replace the old one.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-service" className="text-gray-200">Service Category</Label>
                  <select
                    id="edit-service"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select a service</option>
                    {services.map((svc) => (
                      <option key={svc._id} value={svc._id}>
                        {svc.name}
                      </option>
                    ))}
                  </select>
                </div>


                <div className="space-y-2">
                  <Label htmlFor="edit-image" className="text-gray-200">Image File (Optional)</Label>
                  <Input
                    id="edit-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="bg-white/5 border-white/10 text-white file:text-white file:bg-transparent file:border-0"
                  />
                </div>

                {imagePreview && (
                  <div className="w-40 h-40 bg-white/5 rounded-lg overflow-hidden mx-auto">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={submitting}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEdit}
                  disabled={submitting}
                  className="bg-black text-white hover:bg-black/90"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="bg-gray-900 text-white border border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300">
                  This action cannot be undone. This will permanently delete the gallery item &quot;
                  {selectedItem?.category}&quot;.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={submitting} className="border-white/20 text-white hover:bg-white/10">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={submitting}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {submitting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </section>
  );
}
