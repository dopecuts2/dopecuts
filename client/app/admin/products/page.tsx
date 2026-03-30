// app/admin/products/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { getAllProducts, createProduct, updateProduct, deleteProduct, IProduct } from '@/lib/api/product';

// An empty product template for the 'Add Product' modal form.
const emptyProduct = {
  name: '',
  description: '',
  price: 0,
  affiliateLink: '',
  image: '',
};

export default function Products() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<IProduct> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Function to fetch all products from the API
  const fetchProducts = async () => {
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      // Here you could add user-facing error handling, like a toast notification
    }
  };

  // Fetch products when the component mounts
  useEffect(() => {
    fetchProducts();
  }, []);

  // Handlers for opening modals
  const handleOpenAddModal = () => {
    setIsNew(true);
    setCurrentProduct(emptyProduct);
    setImageFile(null);
    setImagePreview('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: IProduct) => {
    setIsNew(false);
    setCurrentProduct({ ...product });
    setImageFile(null);
    setImagePreview(product.image || '');
    setIsModalOpen(true);
  };
  
  const handleOpenDeleteModal = (product: IProduct) => {
    setCurrentProduct(product);
    setIsDeleteModalOpen(true);
  };

  // Handler for form input changes in the modal
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setCurrentProduct(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(file ? URL.createObjectURL(file) : '');
  };

  // Handler for saving changes (Add or Edit)
  const handleSaveProduct = async () => {
    if (!currentProduct) return;

    const formData = new FormData();
    Object.entries(currentProduct).forEach(([key, value]) => {
      if (key === '_id' || key === 'image' || value === null || value === undefined) return;
      const payloadValue =
        typeof value === 'number' ? value.toString() : (value as string | Blob);
      formData.append(key, payloadValue);
    });
    if (imageFile) {
      formData.append('image', imageFile);
    } else if (currentProduct.image) {
      formData.append('image', currentProduct.image);
    }

    try {
      if (isNew) {
        await createProduct(formData);
      } else if (currentProduct._id) {
        await updateProduct(currentProduct._id, formData);
      }
      await fetchProducts(); // Refresh the product list
    } catch (error) {
      console.error('Failed to save product:', error);
    } finally {
      setIsModalOpen(false);
      setCurrentProduct(null);
      setImageFile(null);
      setImagePreview('');
    }
  };

  // Handler for deleting a product
  const handleDeleteProduct = async () => {
    if (!currentProduct?._id) return;
    try {
      await deleteProduct(currentProduct._id);
      await fetchProducts(); // Refresh the product list
    } catch (error) {
      console.error('Failed to delete product:', error);
    } finally {
      setIsDeleteModalOpen(false);
      setCurrentProduct(null);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-900 py-16">
        <div className="container-max section-padding">
          <div className="flex justify-between items-center mb-12">
            <div className="text-left">
              <h1 className="text-5xl font-bold text-white mb-6">Manage Products</h1>
              <p className="text-xl text-gray-300 max-w-2xl">
                Add, edit, or remove products from your inventory.
              </p>
            </div>
            <Button onClick={handleOpenAddModal} className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              Add Product
            </Button>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => {
              const card = (
                <Card className="hover-lift overflow-hidden bg-gray-800 border-gray-700 flex flex-col h-full">
                  <div className="aspect-square relative">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Note: The properties below are not in IProduct, but the UI is kept for potential future use. */}
                    {/* {product.originalPrice && (
                      <Badge className="absolute top-4 left-4 bg-red-500">
                        Sale
                      </Badge>
                    )}
                    {!product.inStock && (
                      <Badge className="absolute top-4 right-4 bg-gray-500">
                        Out of Stock
                      </Badge>
                    )} */}
                  </div>
                  
                  <CardHeader>
                    <CardTitle className="text-lg text-white">{product.name}</CardTitle>
                    {/* {product.category && (
                      <Badge variant="outline" className="mt-2 w-fit">
                        {product.category}
                      </Badge>
                    )} */}
                    <CardDescription className="pt-2 text-gray-300">
                      {product.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-grow flex flex-col justify-end">
                    {/* <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="ml-1 text-sm font-medium">{product.rating}</span>
                      </div>
                      <span className="text-sm text-gray-400">({product.reviews} reviews)</span>
                    </div> */}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-white">${product.price}</span>
                        {/* {product.originalPrice && (
                          <span className="text-lg text-gray-400 line-through">
                            ${product.originalPrice}
                          </span>
                        )} */}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); handleOpenEditModal(product); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={(e) => { e.preventDefault(); handleOpenDeleteModal(product); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );

              return product.affiliateLink ? (
                <a
                  href={product.affiliateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={product._id}
                >
                  {card}
                </a>
              ) : (
                <div key={product._id}>{card}</div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit/Add Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add New Product' : 'Edit Product'}</DialogTitle>
            <DialogDescription>
              {isNew ? 'Fill in the details for the new product.' : 'Make changes to your product here. Click save when you\'re done.'}
            </DialogDescription>
          </DialogHeader>
          {currentProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" value={currentProduct.name} onChange={handleInputChange} className="col-span-3 bg-gray-700 border-gray-600" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Description</Label>
                <Input id="description" value={currentProduct.description} onChange={handleInputChange} className="col-span-3 bg-gray-700 border-gray-600" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">Price</Label>
                <Input id="price" type="number" value={currentProduct.price} onChange={handleInputChange} className="col-span-3 bg-gray-700 border-gray-600" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="affiliateLink" className="text-right">Affiliate Link</Label>
                <Input id="affiliateLink" value={currentProduct.affiliateLink || ''} onChange={handleInputChange} className="col-span-3 bg-gray-700 border-gray-600" placeholder="https://..." />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="image" className="text-right">Image</Label>
                <div className="col-span-3 space-y-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="bg-gray-700 border-gray-600 text-white file:text-white file:bg-transparent file:border-0"
                  />
                  {imagePreview && (
                    <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveProduct}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the product: <span className="font-semibold text-white">{currentProduct?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteProduct}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
