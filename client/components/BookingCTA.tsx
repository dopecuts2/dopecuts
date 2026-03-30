// components/BookingCTA.tsx
'use client';

import Link from 'next/link';
import { Calendar, MapPin, Phone } from 'lucide-react';

export function BookingCTA() {
  return (
    <section className="relative py-24 text-white overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-950" aria-hidden="true" />
      <div className="absolute inset-0 bg-white/5" aria-hidden="true" />

      <div className="relative z-10">
        <div className="container-max section-padding text-center">
          <div className="fade-in">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready for Your Best Look?</h2>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
              Book your appointment online and experience the DopeCuts difference.
              Professional service, premium results.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link
                href="/book"
                aria-label="Book Now"
                className="inline-flex items-center justify-center text-lg px-8 py-6 rounded-full font-semibold hover-lift transition-all duration-200 hover:scale-105 bg-white hover:bg-gray-100 text-black-950"
              >
                <Calendar className="mr-2 h-5 w-5 text-black-950" />
                Book Now
              </Link>

              <Link
                href="/contact"
                aria-label="Call Us"
                className="inline-flex items-center justify-center text-lg px-8 py-6 rounded-full font-semibold hover-lift transition-all duration-200 bg-white hover:bg-gray-100 text-black-950"
              >
                <Phone className="mr-2 h-5 w-5 text-black-950" />
                Call Us
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <MapPin className="h-8 w-8 mx-auto mb-4 text-gray-300" />
                <div className="font-semibold mb-2">Location</div>
                <div className="text-gray-300">646 Upper James Street, Hamilton ON, L9C 2Z2</div>
              </div>
              <div className="text-center">
                <Phone className="h-8 w-8 mx-auto mb-4 text-gray-300" />
                <div className="font-semibold mb-2">Phone</div>
                <div className="text-gray-300">(365) 323-3680</div>
              </div>
              <div className="text-center">
                <Calendar className="h-8 w-8 mx-auto mb-4 text-gray-300" />
                <div className="font-semibold mb-2">Hours</div>
                <div className="text-gray-300">Mon-Sat: 10AM-7PM</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}