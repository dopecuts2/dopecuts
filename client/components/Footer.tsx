// components/Footer.tsx
'use client';

import Link from 'next/link';
import {
  MapPin,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Twitter,
  Clock,
  Linkedin,
  Youtube,
  Send,
  MessageCircle,
  Music2,
  PlaySquare,
  MessageSquare,
  Link2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getActiveSocials, ISocial } from '@/lib/api/socials';

export function Footer() {
  const [socials, setSocials] = useState<ISocial[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const iconMap: Record<string, React.ComponentType<any>> = {
    instagram: Instagram,
    facebook: Facebook,
    twitter: Twitter,
    linkedin: Linkedin,
    youtube: Youtube,
    snapchat: MessageSquare,
    whatsapp: MessageCircle,
    telegram: Send,
    tiktok: Music2,
    pinterest: PlaySquare,
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getActiveSocials();
        setSocials(data);
      } catch (err) {
        // swallow to keep footer up
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const socialList = useMemo(() => {
    if (!socials.length) {
      return [
        { platform: 'instagram', label: 'Instagram', url: '#' },
        { platform: 'facebook', label: 'Facebook', url: '#' },
        { platform: 'twitter', label: 'Twitter', url: '#' },
      ];
    }
    return socials;
  }, [socials]);

  return (
    <footer className="relative text-white bg-gray-900">
      {/* Background: match Services with gray-900 base, and a subtle gray-900→gray-950 gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-950"
        aria-hidden="true"
      />
      {/* Subtle white film on top */}
      <div className="absolute inset-0 bg-white/5" aria-hidden="true" />

      <div className="relative z-10">
        <div className="container-max section-padding">
          {/* Main Footer Content */}
          <div className="py-16 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
              {/* Brand Section */}
              <div className="lg:col-span-1">
                <Link href="/" className="flex items-center space-x-4 mb-8 group">
                  <div className="flex flex-col">
                    <span className="text-3xl lg:text-4xl font-bold tracking-tight">DOPECUTS</span>
                    <span className="text-sm opacity-80 tracking-widest font-medium">
                      PREMIUM BARBERSHOP
                    </span>
                  </div>
                </Link>

                <p className="mb-8 text-lg leading-relaxed text-white/90">
                  Where tradition meets innovation. Experience the art of grooming with our master
                  barbers and premium services that define modern masculinity.
                </p>

                {/* Social Media */}
                <div>
                  <h4 className="font-bold text-lg mb-4">Follow Us</h4>
                  <div className="flex space-x-4">
                    {socialList.map((s) => {
                      const Icon = iconMap[s.platform] || Link2;
                      return (
                        <a
                          key={`${s.platform}-${s.url}`}
                          href={s.url}
                          aria-label={s.label}
                          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 hover:scale-110"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Icon className="h-6 w-6" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Services & Contact Combined */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Services */}
                <div>
                  <h3 className="font-bold text-xl mb-8">Our Services</h3>
                  <ul className="space-y-4">
                    {[
                      'Classic Cuts',
                      'Beard Grooming',
                      'Premium Package',
                      'Express Service',
                      'Hair Styling',
                      'Consultations',
                    ].map((service) => (
                      <li key={service}>
                        <span className="flex items-center text-white/90 hover:text-white transition-colors duration-300 cursor-pointer text-lg group">
                          <span className="w-2 h-2 rounded-full mr-4 bg-white/40 group-hover:bg-white transition-colors duration-300"></span>
                          {service}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="font-bold text-xl mb-8">Get In Touch</h3>
                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className="p-3 rounded-xl bg-white/10 flex-shrink-0">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold mb-2 text-lg">Visit Our Shop</p>
                        <p className="leading-relaxed text-white/80">
                          646 Upper James Street,
                          <br />
                          Hamilton, ON
                          <br />
                          L9C 2Z2
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4">
                      <div className="p-3 rounded-xl bg-white/10 flex-shrink-0">
                        <Phone className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold mb-2 text-lg">Call Us</p>
                        <p className="text-lg font-medium">(365) 323-3680</p>
                        <p className="text-sm text-white/70">Available during business hours</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4">
                      <div className="p-3 rounded-xl bg-white/10 flex-shrink-0">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold mb-2 text-lg">Business Hours</p>
                        <div className="space-y-1 text-white/85">
                          <p>Mon - Fri: 11:00 AM - 6:00 PM</p>
                          <p>Saturday: 10:00 AM - 6:00 PM</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4">
                      <div className="p-3 rounded-xl bg-white/10 flex-shrink-0">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold mb-2 text-lg">Email Us</p>
                        <p className="text-lg">leeroy@dopecuts.ca</p>
                        <p className="text-sm text-white/70">We&apos;ll respond within 24 hours</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* /Services & Contact */}
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-white/10">
          <div className="container-max section-padding py-8">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
              <div className="text-center lg:text-left">
                <p className="text-lg mb-2">© 2025 DopeCuts. All rights reserved.</p>
                <p className="text-sm text-white/80">
                  Crafted with precision and passion for the modern gentleman.
                </p>
              </div>

              <div className="flex flex-wrap justify-center lg:justify-end gap-6">
                <Link
                  href="/privacy"
                  className="text-white/90 hover:text-white transition-colors text-lg"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="text-white/90 hover:text-white transition-colors text-lg"
                >
                  Terms of Service
                </Link>
                <Link
                  href="/sitemap"
                  className="text-white/90 hover:text-white transition-colors text-lg"
                >
                  Sitemap
                </Link>
              </div>
            </div>
          </div>
        </div>
        {/* /Bottom Footer */}
      </div>
    </footer>
  );
}
