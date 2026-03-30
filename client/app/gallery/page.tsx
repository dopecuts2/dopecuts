// dopekuts/app/gallery/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAllGalleryItems, IGallery } from '@/lib/api/gallery';
import { Skeleton } from '@/components/ui/skeleton';

export default function Gallery() {
  const [items, setItems] = useState<IGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const data = await getAllGalleryItems();
        setItems(data || []);
        if (data && data.length > 0) {
          setSelectedCategory('All');
        }
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to load gallery.');
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
    return ['All', ...cats];
  }, [items]);

  const filteredItems =
    selectedCategory === 'All'
      ? items
      : items.filter((item) => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-900 py-16">
      <div className="container-max section-padding">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-6">Our Work</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            See the quality and precision that sets DopeCuts apart. Every cut tells a story of
            craftsmanship and attention to detail.
          </p>

          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="flex justify-center gap-4 flex-wrap">
              {categories.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <Badge
                    key={category}
                    variant={isActive ? 'default' : 'outline'}
                    className={`cursor-pointer px-4 py-2 ${
                      isActive ? '' : 'text-white border-white/40 hover:bg-white/10'
                    }`}
                    onClick={() => {
                      setSelectedCategory(category);
                      setSelectedId(null);
                    }}
                  >
                    {category}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Gallery Grid */}
        {error && (
          <div className="text-center text-red-400 mb-8">{error}</div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx} className="overflow-hidden bg-gray-800 border-gray-700">
                <CardContent className="p-0">
                  <Skeleton className="w-full aspect-square" />
                  <div className="p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredItems.map((item, idx) => {
              const isSelected = selectedId === item._id;
              return (
                <Card
                  key={item._id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(isSelected ? null : item._id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(isSelected ? null : item._id);
                    }
                  }}
                  className={`overflow-hidden cursor-pointer bg-gray-800 border ${
                    isSelected ? 'border-2 border-white' : 'border-gray-700'
                  } transition-colors duration-300 hover-lift`}
                >
                  <CardContent className="p-0">
                    <div className="aspect-square relative">
                      <Image
                        src={item.image}
                        alt={`${item.category} example`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                        priority={idx < 2}
                      />
                      <div
                        className={`absolute inset-0 flex items-end transition-all duration-300 ${
                          isSelected
                            ? 'bg-white/40 opacity-100'
                            : 'bg-black/20 opacity-0 hover:opacity-100'
                        }`}
                      >
                        <div className="p-4 w-full flex justify-between items-center">
                          <Badge
                            className={
                              isSelected
                                ? 'bg-white text-black border-black/10'
                                : 'bg-white/20 text-white border-white/20'
                            }
                          >
                            {item.category}
                          </Badge>
                          {item.serviceName && (
                            <span className="text-xs text-white/80 bg-black/40 px-2 py-1 rounded-full">
                              {item.serviceName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Call to Action */}
        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold text-white mb-4">Ready for Your Transform?</h2>
          <p className="text-gray-300 mb-8">
            Book your appointment today and join our gallery of satisfied customers.
          </p>
          <a
            href="/book"
            className="inline-flex items-center px-8 py-4 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors duration-200 font-semibold"
          >
            Book Your Appointment
          </a>
        </div>
      </div>
    </div>
  );
}
