'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { getSiteNotice } from '@/lib/api/notifications';

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const [notice, setNotice] = useState<{ enabled: boolean; message: string } | null>(null);
  const [showNotice, setShowNotice] = useState(false);

  const noticeKey = useMemo(() => (notice?.message ? `site-notice-${notice.message}` : ''), [notice]);

  useEffect(() => {
    if (isAdminRoute) return;
    let mounted = true;
    getSiteNotice()
      .then((data) => {
        if (!mounted) return;
        setNotice(data);
        if (data.enabled && data.message) {
          const key = `site-notice-${data.message}`;
          const hidden = typeof window !== 'undefined' ? window.sessionStorage.getItem(`hide-${key}`) : null;
          if (!hidden) {
            setShowNotice(true);
          }
        }
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      mounted = false;
    };
  }, [isAdminRoute, noticeKey]);

  useEffect(() => {
    if (isAdminRoute) return;
    const originalOverflow = typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (showNotice) {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    } else {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = originalOverflow || '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = originalOverflow || '';
      }
    };
  }, [showNotice, isAdminRoute]);

  const handleDismiss = () => {
    setShowNotice(false);
    if (noticeKey && typeof window !== 'undefined') {
      window.sessionStorage.setItem(`hide-${noticeKey}`, '1');
    }
  };

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <main className="flex-1 relative">
        {showNotice && notice?.enabled && notice.message && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="relative max-w-lg w-full bg-gray-900 text-white rounded-2xl shadow-2xl p-6 space-y-4 border border-white/10">
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label="Close notice"
              >
                ×
              </button>
              <h3 className="text-lg font-semibold">Notice</h3>
              <p className="text-sm whitespace-pre-line text-gray-200">{notice.message}</p>
            </div>
          </div>
        )}
        {children}
      </main>
      <Footer />
    </>
  );
}
