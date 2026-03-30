'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  CalendarClock,
  Mail,
  MessageSquare,
  Package,
  PaperclipIcon,
  Scissors,
  Settings,
  X,
  Images,
  type LucideProps,
  MessageCircle,
  Paperclip,
  Share2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}
type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<LucideProps>;
};

const navItems: NavItem[] = [
  // Core operations
  { title: 'Booking', href: '/admin/booking', icon: Calendar },
  { title: 'Queue', href: '/admin/queue', icon: CalendarClock },
  { title: 'Calendar', href: '/admin/calendar', icon: CalendarClock },

  // Catalog
  { title: 'Services', href: '/admin/services', icon: Scissors },
  { title: 'Products', href: '/admin/products', icon: Package },
  { title: 'Gallery', href: '/admin/gallery', icon: Images },

  // Customer comms
  { title: 'Tickets', href: '/admin/tickets', icon: MessageCircle },
  { title: 'Message Center', href: '/admin/message-center', icon: PaperclipIcon },
  { title: 'Contact', href: '/admin/contact', icon: MessageSquare },
  { title: 'Socials', href: '/admin/socials', icon: Share2 },

  // Meta
  { title: 'Settings', href: '/admin/settings', icon: Settings },
  { title: 'About', href: '/admin/about', icon: Info },
];

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
          <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-white">DopeCuts</h2>
              <p className="text-sm text-gray-400">Admin Panel</p>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-white text-black'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.title}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs text-gray-500 text-center">
              DopeCuts Admin v1.0
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
