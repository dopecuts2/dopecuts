// app/products/page.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getAllProducts, IProduct } from '@/lib/api/product';
import { getProductNotice } from '@/lib/api/notifications';
import { useRouter } from 'next/navigation';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x400?text=No+Image';

export default function Products() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ enabled: boolean; message: string } | null>(null);
  const [showNotice, setShowNotice] = useState(false);
  const router = useRouter();

  const noticeKey = useMemo(
    () => (notice?.message ? `product-notice-${notice.message}` : ''),
    [notice]
  );

  useEffect(() => {
    async function loadProducts() {
      try {
        setIsLoading(true);
        const apiProducts = await getAllProducts();
        setProducts(apiProducts);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('Could not load products. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }
    loadProducts();
  }, []);

  useEffect(() => {
    let mounted = true;
    getProductNotice()
      .then((data) => {
        if (!mounted) return;
        setNotice(data);
        if (data.enabled && data.message) {
          const hidden = typeof window !== 'undefined'
            ? window.sessionStorage.getItem(`hide-${noticeKey || `product-notice-${data.message}`}`)
            : null;
          if (!hidden) setShowNotice(true);
        }
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      mounted = false;
    };
  }, [noticeKey]);

  useEffect(() => {
    const originalOverflow = typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (showNotice) {
      if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';
    } else {
      if (typeof document !== 'undefined') document.body.style.overflow = originalOverflow || '';
    }
    return () => {
      if (typeof document !== 'undefined') document.body.style.overflow = originalOverflow || '';
    };
  }, [showNotice]);

  const handleDismiss = () => {
    setShowNotice(false);
    if (noticeKey && typeof window !== 'undefined') {
      window.sessionStorage.setItem(`hide-${noticeKey}`, '1');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 py-16 flex justify-center items-center">
        <h2 className="text-3xl font-bold text-white">Loading Products...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 py-16 flex justify-center items-center">
        <h2 className="text-3xl font-bold text-red-500">{error}</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-16">
      <div className="container-max section-padding">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-6">Hair Products</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Professional-grade products used and trusted by our barbers.
            Get the same quality styling products we use in our shop.
          </p>
        </div>

        {showNotice && notice?.enabled && notice.message && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="relative max-w-lg w-full bg-gray-900 text-white rounded-2xl shadow-2xl p-6 space-y-4 border border-white/10">
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label="Close notice"
              >
                ×
              </button>
              <h3 className="text-lg font-semibold">Notice</h3>
              <p className="text-sm whitespace-pre-line text-gray-200">{notice.message}</p>
            </div>
          </div>
        )}

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <Card key={product._id} className="hover-lift overflow-hidden bg-gray-800 border-gray-700">
              <div className="aspect-square relative">
                <img
                  src={product.image || PLACEHOLDER_IMAGE}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg text-white">{product.name}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2 text-gray-300">
                  {product.description || 'No description available.'}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">${product.price}</span>
                  </div>

                  {product.affiliateLink ? (
                    <Button
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => {
                        window.open(product.affiliateLink, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Get Now
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2"
                      onClick={() => router.push('/contact')}
                    >
                      Contact Us
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section — dark theme to match Services */}
        <div className="mt-16 bg-gray-800 border border-gray-700 p-8 rounded-lg">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Why Choose Our Products?</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Every product in our collection is personally tested and approved by our master barbers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-white text-black p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                ✓
              </div>
              <h3 className="font-bold text-white mb-2">Professional Grade</h3>
              <p className="text-gray-300">The same products used by our expert barbers</p>
            </div>

            <div className="text-center">
              <div className="bg-white text-black p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                ★
              </div>
              <h3 className="font-bold text-white mb-2">Premium Quality</h3>
              <p className="text-gray-300">Only the finest ingredients and formulations</p>
            </div>

            <div className="text-center">
              <div className="bg-white text-black p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                ❤
              </div>
              <h3 className="font-bold text-white mb-2">Customer Approved</h3>
              <p className="text-gray-300">Loved by thousands of satisfied customers</p>
            </div>
          </div>
        </div>
        {/* End Info Section */}
      </div>
    </div>
  );
}
