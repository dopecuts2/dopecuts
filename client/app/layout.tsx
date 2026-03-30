import './globals.css';
import type { Metadata } from 'next';
import { LayoutContent } from '@/components/ LayoutContent';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'DopeCuts - Premium Barbershop Experience',
  description: 'Professional barbershop services with online booking, premium cuts, and exceptional customer service.',
  keywords: 'barbershop, haircuts, grooming, beard trim, styling, appointments',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <LayoutContent>{children}</LayoutContent>
        <Toaster />
      </body>
    </html>
  );
}