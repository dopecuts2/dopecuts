// lib/api/gallery.ts
// This file mirrors the structure of product.ts, but is adapted for the gallery API.

// This interface mirrors the Mongoose model 'IGalleryItem' from src/models/gallery.model.ts
export interface IGallery {
  _id: string;
  category: string;
  image: string;
  serviceId: string;
  serviceName: string;
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const fetchWithApiBase = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Gallery request failed: ${response.statusText}`);
 }

  return response;
};

/**
 * Fetches all gallery items.
 * Mirrors getAllProducts()
 * Backend route: GET /api/v1/gallery
 */
export const getAllGalleryItems = async (): Promise<IGallery[]> => {
  try {
    const response = await fetchWithApiBase('/gallery');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching gallery items:', error);
    throw error; // Re-throw to be handled by the component
  }
};

/**
 * Creates a new gallery item.
 * Mirrors createProduct(formData)
 * Expects FormData containing 'category' and 'image' (file).
 * Backend route: POST /api/v1/gallery
 */
export const createGalleryItem = async (formData: FormData): Promise<IGallery> => {
  try {
    const response = await fetchWithApiBase('/gallery', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating gallery item:', error);
    throw error;
  }
};

/**
 * Updates an existing gallery item by its ID.
 * Mirrors updateProduct(id, formData)
 * Expects FormData containing optional 'category' and/or 'image' (file).
 * Backend route: PUT /api/v1/gallery/:id
 */
export const updateGalleryItem = async (id: string, formData: FormData): Promise<IGallery> => {
  try {
    const response = await fetchWithApiBase(`/gallery/${id}`, {
      method: 'PUT',
      body: formData,
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error updating gallery item ${id}:`, error);
    throw error;
  }
};

/**
 * Deletes a gallery item by its ID.
 * Mirrors deleteProduct(id)
 * Backend route: DELETE /api/v1/gallery/:id
 */
export const deleteGalleryItem = async (id: string): Promise<{ message: string }> => {
  try {
    const response = await fetchWithApiBase(`/gallery/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    return data; // Backend returns { message: '...' }
  } catch (error) {
    console.error(`Error deleting gallery item ${id}:`, error);
    throw error;
  }
};
