import cors from 'cors';
import { NODE_ENV } from '../config/env';

// List of all trusted frontend domains
const allowedOrigins = [
  // Production URLs from your Vercel account
  'https://dopecuts.ca',
  'https://admin.dopecuts.ca',       // <-- ADD THIS for your admin panel
  'https://dopekuts.vercel.app',    // <-- ADD THIS Vercel default URL

  // Local development URLs
  'http://localhost:3000',
  'http://localhost:5173',
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // The 'origin' can be 'undefined' for server-to-server requests or API tools.
    // We allow these requests, as well as any origin in our trusted list.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // If the origin is not in our list, we reject the request.
      callback(new Error('This origin is not allowed by CORS'));
    }
  },
  credentials: true, // This allows cookies to be sent and received
};

export const corsWithOptions = cors(corsOptions);
