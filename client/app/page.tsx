import { Hero } from '@/components/Hero';
import { Services } from '@/components/Services';
import { About } from '@/components/About';
import { BookingCTA } from '@/components/BookingCTA';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Hero />
      <Services />
      <About />
      <BookingCTA />
    </div>
  );
}