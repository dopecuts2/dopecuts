'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Calendar, Phone, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="container-max section-padding py-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* 404 Number */}
          <div className="mb-8">
            <h1 className="text-8xl md:text-9xl font-bold text-white/20 mb-4">404</h1>
            <div className="w-24 h-1 bg-white mx-auto mb-8"></div>
          </div>

          {/* Main Content */}
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Oops! Page Not Found
            </h2>
            <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
              Looks like this page got a bad haircut and had to be removed. 
              Don't worry, we'll help you find what you're looking for.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <Button asChild variant="outline" className="border-gray-600 bg-black-600 text-white hover:bg-white hover:text-black-600 p-6 h-auto flex-col space-y-2">
              <Link href="/">
                <Home className="h-6 w-6" />
                <span>Home</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="border-gray-600 bg-black-600 text-white hover:bg-white hover:text-black-600 p-6 h-auto flex-col space-y-2">
              <Link href="/book">
                <Calendar className="h-6 w-6" />
                <span>Book Now</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="border-gray-600 bg-black-600 text-white hover:bg-white hover:text-black-600 p-6 h-auto flex-col space-y-2">
              <Link href="/gallery">
                <Search className="h-6 w-6" />
                <span>Gallery</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="border-gray-600 bg-black-600 text-white hover:bg-white hover:text-black-600 p-6 h-auto flex-col space-y-2">
              <Link href="/contact">
                <Phone className="h-6 w-6" />
                <span>Contact</span>
              </Link>
            </Button>
          </div>

          {/* Contact Info */}
          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">
              Still can't find what you're looking for?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-gray-300">
              <a 
                href="tel:+13653233680" 
                className="flex items-center space-x-2 hover:text-white transition-colors duration-200"
              >
                <Phone className="h-4 w-4" />
                <span>(365) 323-3680</span>
              </a>
              <div className="hidden sm:block w-1 h-1 bg-gray-600 rounded-full"></div>
              <a 
                href="mailto:leeroy@dopecuts.ca" 
                className="hover:text-white transition-colors duration-200"
              >
                leeroy@dopecuts.ca
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}