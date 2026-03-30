// dopekuts/lib/api/product.ts
import apiClient from './apiClient';

// --- Interfaces ---

export interface IProduct {
    _id: string;
    name: string;
    price: number;
    description?: string;
    image?: string; // URL to the image
    affiliateLink?: string; // <-- Added affiliate link
    createdAt: string;
    updatedAt: string;
}

// --- API Functions ---

/**
 * Get all products.
 * @access Public
 */
export async function getAllProducts(): Promise<IProduct[]> {
    const response = await apiClient.get<IProduct[]>('/products');
    return response.data;
}

/**
 * Get a single product by its ID.
 * @access Public
 */
export async function getProductById(id: string): Promise<IProduct> {
    const response = await apiClient.get<IProduct>(`/products/${id}`);
    return response.data;
}

// --- Admin-Only Functions ---

/**
 * Create a new product. Accepts FormData for image uploads.
 * @param formData - A FormData object containing product fields and optionally an 'image' file.
 * @access Private (Admin only)
 */
export async function createProduct(formData: FormData): Promise<IProduct> {
    const response = await apiClient.post<IProduct>('/products', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        timeout: 120_000,
    });
    return response.data;
}

/**
 * Update an existing product. Accepts FormData for image uploads.
 * @param id - The ID of the product to update.
 * @param formData - A FormData object containing fields to update and optionally a new 'image' file.
 * @access Private (Admin only)
 */
export async function updateProduct(id: string, formData: FormData): Promise<IProduct> {
    const response = await apiClient.put<IProduct>(`/products/${id}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        timeout: 120_000,
    });
    return response.data;
}

/**
 * Delete a product by its ID.
 * @access Private (Admin only)
 */
export async function deleteProduct(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/products/${id}`);
    return response.data;
}
