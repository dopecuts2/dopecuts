// components/Navigation.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Services', href: '/services' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Products', href: '/products' },
    { name: 'Contact', href: '/contact' },
  ];

  // Header shell: glass in both states; scrolled gets darker & bordered.
  const shell = isScrolled
    ? 'relative bg-gray-950/75 supports-[backdrop-filter]:bg-gray-950/60 backdrop-blur-sm border-b border-gray-800 shadow-lg'
    : 'relative';

  return (
    <>
      <nav className={`sticky top-0 z-50 transition-colors duration-300 ${shell}`}>
        {/* Background layers: gradient + subtle white film when not scrolled */}
        {!isScrolled && (
          <>
            <div
              className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-950"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-white/5" aria-hidden="true" />
          </>
        )}
        {/* When scrolled, keep a faint film to retain glass feel */}
        {isScrolled && <div className="absolute inset-0 bg-white/5" aria-hidden="true" />}

        <div className="container-max section-padding relative">
          <div className="flex justify-between items-center h-20 relative z-10">
            {/* Logo */}
            <Link href="/" className="flex items-center" aria-label="DOPECUTS Home">
              <Image
                src="/logo.png"
                alt="DOPECUTS Logo"
                width={48}
                height={48}
                className="object-contain"
                priority
              />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-200 hover:text-white transition-colors duration-200 font-medium text-sm uppercase tracking-wide relative group"
                >
                  {item.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white transition-all duration-200 group-hover:w-full" />
                </Link>
              ))}
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center">
              <Button
                asChild
                className="bg-white text-black hover:bg-gray-100 hover:text-black font-semibold px-6 py-2 rounded-full transition-all duration-200 hover:scale-105"
              >
                <Link href="/book" aria-label="Book Appointment">
                  Book Appointment
                </Link>
              </Button>
            </div>

            {/* Mobile toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setIsOpen((v) => !v)}
                className="text-gray-200 hover:text-white transition-colors duration-200 p-2"
                aria-label="Toggle menu"
              >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Overlay (true glass) */}
      {isOpen && (
        <div
          className="
            fixed inset-0 z-[60]
            bg-gray-950/70 supports-[backdrop-filter]:bg-gray-950/40
            backdrop-blur-md
            transition-opacity
          "
        >
          <div className="container-max section-padding pt-6">
            {/* Top bar inside overlay */}
            <div className="flex items-center justify-between h-12">
              <Image
                src="/logo.png"
                alt="DOPECUTS Logo"
                width={40}
                height={40}
                className="object-contain"
              />
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="p-2 text-gray-200 hover:text-white transition-colors"
              >
                <X className="h-7 w-7" />
              </button>
            </div>

            {/* Menu list – no opaque panel/background */}
            <div className="mt-4">
              <nav className="flex flex-col">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="py-5 text-xl font-medium tracking-wide uppercase text-gray-200 hover:text-white transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="mt-6">
                <Button
                  asChild
                  className="w-full bg-white text-black hover:bg-gray-100 hover:text-black"
                >
                  <Link href="/book" onClick={() => setIsOpen(false)}>
                    Book Appointment
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}