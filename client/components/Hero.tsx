'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Calendar, Scissors, Star, Phone } from 'lucide-react';
import { getAllProducts, type IProduct } from '@/lib/api/product';

export function Hero() {
  const [products, setProducts] = useState<IProduct[]>([]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const apiProducts = await getAllProducts();
        setProducts(apiProducts || []);
      } catch (err) {
        console.error('Failed to fetch products for hero marquee:', err);
      }
    }
    loadProducts();
  }, []);

  const marqueeItems = products.slice(0, 8);
  const hasProducts = marqueeItems.length > 0;

  return (
    <>
      <style jsx global>{`
        @keyframes hero-marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes hero-marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }

        .hero-marquee-row {
          display: inline-flex;
          gap: 1rem;
          white-space: nowrap;
          animation: hero-marquee-left 26s linear infinite;
        }

        .hero-marquee-row:hover {
          animation-play-state: paused;
        }

        @media (max-width: 768px) {
          .hero-marquee-row {
            animation: hero-marquee-left 20s linear infinite;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-marquee-row,
          .hero-marquee-row.reverse {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <section className="relative min-h-screen flex items-start justify-center bg-gray-900 pt-10 md:pt-16 pb-12 overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-950"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-7xl mx-auto section-padding text-center pt-0 mt-0">
          <div className="fade-in">
            {hasProducts && (
              <div className="w-full mb-6 sm:mb-10 space-y-3 -mx-4 sm:mx-0">
                <div className="flex items-center gap-3 justify-center sm:justify-between px-4 sm:px-6 lg:px-8">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                    Products we use
                  </span>
                  <Link href="/products" className="text-[11px] text-white/70 hover:text-white">
                    View all
                  </Link>
                </div>

                <div className="overflow-hidden">
                  <Link
                    href="/products"
                    className="group block relative overflow-hidden w-full"
                    aria-label="Browse products"
                  >
                    <div className="hero-marquee-row">
                      {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((product, idx) => (
                        <div
                          key={`${product._id}-${idx}`}
                          className="flex items-center gap-2 sm:gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.25)] flex-shrink-0"
                        >
                          <div className="relative h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-gray-800 to-gray-900 flex-shrink-0">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-white/60 text-center px-1">
                                {product.name}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] sm:text-xs text-white/70 max-w-[80px] sm:max-w-[120px] md:max-w-[160px] truncate">
                              {product.name}
                            </span>
                            {typeof product.price === 'number' && (
                              <span className="text-xs sm:text-sm font-semibold text-white/90 whitespace-nowrap">${product.price}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pointer-events-none absolute left-0 top-0 h-full w-8 sm:w-12 md:w-16 bg-gradient-to-r from-gray-900 via-gray-900/80 to-transparent z-10" />
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-8 sm:w-12 md:w-16 bg-gradient-to-l from-gray-900 via-gray-900/80 to-transparent z-10" />
                  </Link>
                </div>
              </div>
            )}

            <div className="flex justify-center mb-5 sm:mb-6 px-4 sm:px-6 lg:px-8">
              <div className="p-4 bg-white rounded-full">
                <Scissors className="h-12 w-12 text-black-950" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 md:mb-6 tracking-tight px-4 sm:px-6 lg:px-8">
              DOPE<span className="text-black-400">CUTS</span>
            </h1>

            <p className="text-xl md:text-2xl text-black-200 mb-8 max-w-3xl mx-auto leading-relaxed px-4 sm:px-6 lg:px-8">
              Premium barbershop experience with master barbers, modern techniques, and exceptional service.
              Your style, perfected.
            </p>

            <div className="flex flex-col gap-4 justify-center items-center mb-12 px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button size="lg" className="text-lg px-8 py-6 hover-lift" asChild>
                  <Link href="/book">
                    <Calendar className="mr-2 h-5 w-5" />
                    Book Appointment
                  </Link>
                </Button>

                <Button size="lg" className="text-lg px-8 py-6 hover-lift" asChild>
                  <Link href="/reschedule">
                    <Calendar className="mr-2 h-5 w-5" />
                    Manage Appointment
                  </Link>
                </Button>
                <Button size="lg" className="text-lg px-8 py-6 hover-lift" asChild>
  <a href="tel:+13653233680">
    <Phone className="mr-2 h-5 w-5" />
    Call Us
  </a>
</Button>
              </div>

              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 hover-lift"
                asChild
              >
                <Link href="/gallery">View Our Work</Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">5000+</div>
                <div className="text-black-200">Happy Customers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">10+</div>
                <div className="text-black-200">Years Experience</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-3xl font-bold text-white">4.9</span>
                  <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="text-black-200">Average Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
