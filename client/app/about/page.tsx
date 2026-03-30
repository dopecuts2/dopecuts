// dopekuts/app/about/page.tsx
'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getAbout, IAbout, IBarber } from '@/lib/api/about';

export default function About() {
  const [about, setAbout] = useState<IAbout | null>(null);
  const [barbers, setBarbers] = useState<IBarber[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAbout();
        setAbout(data.about);
        setBarbers(data.barbers || []);
      } catch (err) {
        // keep defaults if failed
      }
    };
    void load();
  }, []);

  const values = about?.values?.length ? about.values : [
    'Excellence in every cut',
    'Respect for traditional craftsmanship',
    'Innovation in modern techniques',
    'Building lasting relationships',
  ];

  return (
    <div className="min-h-screen bg-gray-900 py-16">
      <div className="container-max section-padding">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-white mb-6">{about?.heroTitle || 'About DopeCuts'}</h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              {about?.heroSubtitle || "Established in 2014, DopeCuts has been the premier destination for men's grooming in the city."}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">{about?.storyTitle || 'Our Story'}</h2>
              <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                {about?.storyBody ||
                  `What started as a small neighborhood barbershop has grown into the city's most trusted destination for premium men's grooming.`}
              </p>
            </div>

            <div className="space-y-6">
              {about?.mission && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-xl font-bold text-white mb-4">Our Mission</h3>
                  <p className="text-gray-300 whitespace-pre-line">{about.mission}</p>
                </div>
              )}

              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">Our Values</h3>
                <ul className="text-gray-300 space-y-2">
                  {values.map((v) => (
                    <li key={v}>• {v}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Team Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Meet Our Barbers</h2>
            <p className="text-gray-300 mb-12">Skilled professionals dedicated to your style</p>

            <div
              className="grid gap-8 justify-items-center"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, barbers.length || 1))}, minmax(0, 1fr))`,
              }}
            >
              {barbers.map((barber, index) => (
                <div key={barber._id || barber.name} className="text-center w-full max-w-xs">
                  <div className="w-48 h-48 bg-gray-700 rounded-lg mx-auto mb-4 overflow-hidden relative">
                    <Image
                      src={barber.image}
                      alt={`Photo of ${barber.name}`}
                      fill
                      sizes="(max-width: 768px) 192px, 192px"
                      className="object-cover"
                      priority={index === 0}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{barber.name}</h3>
                  <p className="text-gray-300 mb-1">{barber.role}</p>
                  <p className="text-sm text-gray-400">{barber.experience}</p>
                </div>
              ))}
              {barbers.length === 0 && (
                <p className="text-gray-300 col-span-full">Barber profiles coming soon.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
