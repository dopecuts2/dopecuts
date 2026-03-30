// components/Services.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Scissors, Sparkles, Clock } from 'lucide-react';
// Renamed 'Rat' to 'RazorIcon' to avoid conflicts and be more descriptive
import { Rat as RazorIcon } from 'lucide-react'; 
import { useState, useEffect } from 'react';
import { getAllServices, IService } from '@/lib/api/service';
import { LucideIcon } from 'lucide-react';
// --- MODIFICATION: Import useRouter ---
import { useRouter } from 'next/navigation';

/**
 * Helper function to determine which icon to show based on the service name.
 * This is needed because the API response (IService) doesn't include an icon field.
 */
const getServiceIcon = (serviceName: string): LucideIcon => {
  const name = serviceName.toLowerCase();
  if (name.includes('cut')) {
    return Scissors;
  }
  if (name.includes('beard') || name.includes('shave')) {
    return RazorIcon;
  }
  if (name.includes('package') || name.includes('premium')) {
    return Sparkles;
  }
  if (name.includes('express')) {
    return Clock;
  }
  // Default icon
  return Scissors;
};

const ADAPTIVE_SERVICE_RULES: Array<{ keywords: string[]; duration: number }> = [
  { keywords: ['kids cut', 'kid cut'], duration: 20 },
  { keywords: ['hair line up', 'hair line-up', 'hair lineup', 'lineup'], duration: 20 },
  { keywords: ['beard trim'], duration: 20 },
  { keywords: ['deluxe'], duration: 60 },
];

const getAdaptiveDuration = (service?: IService) => {
  if (!service) return 40;
  const normalized = (service.name || '').toLowerCase();
  const rule = ADAPTIVE_SERVICE_RULES.find((r) =>
    r.keywords.some((keyword) => normalized.includes(keyword))
  );
  if (rule) return rule.duration;
  return Math.max(service.duration, 40);
};

export function Services() {
  const [services, setServices] = useState<IService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // --- MODIFICATION: Instantiate router ---
  const router = useRouter();

  useEffect(() => {
    async function loadServices() {
      try {
        setIsLoading(true);
        const apiServices = await getAllServices();
        setServices(apiServices);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch services:', err);
        setError('Could not load services. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    loadServices();
  }, []);

  return (
    <section className="py-24 bg-gray-900">
      <div className="container-max section-padding">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Our Services
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Professional grooming services delivered by master barbers with years of experience
          </p>
        </div>

        {/* --- Handle Loading State --- */}
        {isLoading && (
          <div className="text-center">
            <h3 className="text-2xl text-white">Loading Services...</h3>
          </div>
        )}

        {/* --- Handle Error State --- */}
        {error && (
          <div className="text-center">
            <h3 className="text-2xl text-red-500">{error}</h3>
          </div>
        )}

        {/* --- Render Services Grid --- */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service) => {
              const displayDuration = getAdaptiveDuration(service);
              const Icon = getServiceIcon(service.name);
              return (
                // --- MODIFICATION: Added onClick handler to the Card ---
                <Card 
                  key={service._id} 
                  className="hover-lift cursor-pointer bg-gray-800 border-gray-700"
                  onClick={() => router.push(`/book?serviceId=${service._id}`)}
                >
                  <CardHeader className="text-center">
                    <div className="mx-auto mb-4 p-3 bg-white rounded-full w-fit">
                      <Icon className="h-8 w-8 text-black" />
                    </div>
                    <CardTitle className="text-xl font-bold text-white">{service.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription className="text-gray-300 mb-4 min-h-[3rem]">
                      {service.description || 'No description available.'}
                    </CardDescription>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-white">From ${service.price}</div>
                      <div className="text-sm text-gray-400">{displayDuration} min</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
