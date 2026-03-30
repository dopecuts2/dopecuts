// dopekuts/app/admin/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // State to track authentication status. Defaults to false.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check for the authentication status in local storage.
    const authStatus = localStorage.getItem('admin_authenticated');

    if (authStatus === 'true') {
      // If authenticated, update the state to grant access.
      setIsAuthenticated(true);
    } else {
      // If not authenticated, ensure the state remains false.
      setIsAuthenticated(false);
      // If the user is trying to access any admin page other than the login page,
      // redirect them to the login page.
      if (pathname !== '/admin') {
        router.push('/admin');
      }
    }
  }, [pathname, router]); // Re-run this effect if the path changes.

  // The login page itself should not be protected or have the admin layout.
  // We render its content directly.
  if (pathname === '/admin') {
    return <>{children}</>;
  }

  // For any other route under /admin/*:
  // If the authentication check is not yet complete or has failed,
  // `isAuthenticated` will be false. In this case, we show a loading screen.
  // This screen will show briefly for authenticated users before content loads,
  // and it will show for unauthenticated users while they are being redirected.
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If `isAuthenticated` is true, render the protected admin layout with its content.
  return (
    <div className="min-h-screen bg-gray-900 flex">
      <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        <AdminHeader onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}