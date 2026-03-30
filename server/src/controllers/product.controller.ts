// src/controllers/product.controller.ts
import { Request, Response } from 'express';
import { Product } from '../models/product.model';
import { uploadImage, deleteImage } from '../services/imageService';
import { logger } from '../utils/logger';

/**
 * @description Create a new product. Admin only.
 * @route POST /api/v1/products
 */
export const createProduct = async (req: Request, res: Response) => {
  const { name, price, description, affiliateLink } = req.body;
  if (!name || !price) {
    return res.status(400).json({ message: 'Name and price are required.' });
  }

  try {
    let imageUrl: string | undefined = (req.body.image as string | undefined)?.trim() || undefined;
    if (req.file) {
      imageUrl = await uploadImage(req.file, 'dopecuts/products');
    }

    const newProduct = new Product({
      name,
      price,
      description,
      image: imageUrl,
      affiliateLink, // <-- Added affiliateLink
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product.' });
  }
};

/**
 * @description Get all products. Public.
 * @route GET /api/v1/products
 */
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products.' });
  }
};

/**
 * @description Get a single product by ID. Public.
 * @route GET /api/v1/products/:id
 */
export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.status(200).json(product);
  } catch (error) {
    logger.error(`Error fetching product with id ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch product.' });
  }
};

/**
 * @description Update a product. Admin only.
 * @route PUT /api/v1/products/:id
 */
export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, description, affiliateLink } = req.body;

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    let imageUrl = (req.body.image as string | undefined)?.trim() || product.image;

    // If a new file is uploaded, upload it and delete the old one
    if (req.file) {
      if (product.image) {
        await deleteImage(product.image); // Delete old image from R2
      }
      imageUrl = await uploadImage(req.file, 'dopecuts/products'); // Upload new image
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        price,
        description,
        image: imageUrl,
        affiliateLink, // <-- Added affiliateLink
      },
      { new: true } // Return the updated document
    );

    res.status(200).json(updatedProduct);
  } catch (error) {
    logger.error(`Error updating product with id ${id}:`, error);
    res.status(500).json({ message: 'Failed to update product.' });
  }
};

/**
 * @description Delete a product. Admin only.
 * @route DELETE /api/v1/products/:id
 */
export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // If product has an image, delete it from R2
    if (product.image) {
      await deleteImage(product.image);
    }

    await Product.findByIdAndDelete(id);
    res.status(200).json({ message: 'Product deleted successfully.' });
  } catch (error) {
    logger.error(`Error deleting product with id ${id}:`, error);
    res.status(500).json({ message: 'Failed to delete product.' });
  }
};
