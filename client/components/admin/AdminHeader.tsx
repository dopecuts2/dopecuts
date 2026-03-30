'use client';

import { useRouter } from 'next/navigation';
import { Menu, LogOut, User } from 'lucide-react';

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    router.push('/admin');
  };

  return (
    <header className="sticky top-0 z-30 bg-gray-900 border-b border-gray-800">
      <div className="flex items-center justify-between px-4 py-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
            type="button"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-white">Dashboard</h1>
            <p className="text-sm text-gray-400">Manage your barbershop</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full">
              <User className="h-4 w-4 text-black" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-white">Admin User</p>
              <p className="text-gray-400">admin@dopecuts.com</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="
              inline-flex items-center justify-center
              rounded-md border border-gray-700
              px-3 py-2 text-sm font-medium
              text-gray-300
              hover:bg-gray-800 hover:text-white
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500
            "
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}