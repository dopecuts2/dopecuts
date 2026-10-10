import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DopeCuts.ca Has Moved to DopeCuts.online',
  description:
    'Looking for dopecuts.ca? DopeCuts Barbershop has moved to dopecuts.online. Same barber, same shop inside Elite Barber in Hamilton, ON — book your next haircut online today.',
};

export default function DopecutsCaMovedPage() {
  return (
    <div className="min-h-screen bg-gray-900 py-16">
      <div className="container-max section-padding">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            DopeCuts.ca Has Moved
          </h1>
          <p className="text-xl text-gray-300 mb-10">
            You&apos;re in the right place. DopeCuts — formerly at{' '}
            <span className="text-white font-semibold">dopecuts.ca</span> — is now online at{' '}
            <span className="text-white font-semibold">dopecuts.online</span>. Same barber, same
            shop, new website.
          </p>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 lg:p-10 text-left mb-10">
            <h2 className="text-2xl font-bold text-white mb-4">Visit Us</h2>
            <p className="text-gray-300 leading-relaxed">
              DopeCuts, inside Elite Barber
              <br />
              646 Upper James Street, Hamilton, ON L9C 2Z2
            </p>
            <p className="text-gray-300 mt-4">
              Call / Text: <span className="text-white font-medium">(365) 323-3680</span>
            </p>
          </div>

          <Link
            href="/book"
            className="inline-block rounded-lg px-8 py-4 text-lg font-semibold bg-white text-black hover:bg-gray-200 transition-colors"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}
