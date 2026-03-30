# DopeCuts - Premium Barbershop Website

A modern, full-stack web application for DopeCuts barbershop, built with Next.js, TypeScript, and Tailwind    CSS.

## 🚀 Project Overview

DopeCuts is a comprehensive barbershop management system featuring online booking, customer management, admin dashboard, and e-commerce capabilities. The platform is designed to be modern, elegant, and mobile-responsive.

## ✨ Key Features

### Customer Features
- **Online Booking System**: Book, confirm, reschedule, and cancel appointments
- **Service Selection**: Choose from various barbershop services with pricing
- **Customer Portal**: Track appointment history and manage bookings
- **Product Store**: Browse and purchase hair care products
- **Gallery**: View portfolio of previous work
- **Contact System**: Multiple ways to get in touch

### Admin Features
- **Dashboard**: Comprehensive overview of business metrics
- **Appointment Management**: Full control over scheduling and bookings
- **Customer Relationship Management (CRM)**: Track customer data and analytics
- **SMS Messaging**: Send bulk and individual messages to customers
- **Analytics**: Business performance tracking and reporting
- **Settings**: Configure business hours, pricing, and booking rules

### Business Logic
- **Booking Rules**: 2-month advance booking limit
- **Cancellation Policy**: 24-hour cancellation requirement
- **Payment Options**: Pay now or pay at appointment
- **Repeat Customer Handling**: Special rules for frequent cancellations
- **Time Slot Management**: Admin can block/unblock specific times

## 🎨 Design System

### Typography
- **Font**: Roboto Mono (Google Fonts)
- **Weights**: 100-700 (regular and italic)

### Color Palette
```css
--color-black-50: #f6f6f6;   /* Lightest */
--color-black-100: #e7e7e7;
--color-black-200: #d1d1d1;
--color-black-300: #b0b0b0;
--color-black-400: #888888;
--color-black-500: #6d6d6d;  /* Mid-tone */
--color-black-600: #5d5d5d;
--color-black-700: #4f4f4f;
--color-black-800: #454545;
--color-black-900: #3d3d3d;
--color-black-950: #000000;  /* Darkest */
```

### Design Principles
- **Mobile-First**: Responsive design optimized for all devices
- **Minimalist**: Clean, professional aesthetic
- **Apple-level Polish**: Attention to detail in animations and interactions
- **Accessibility**: High contrast ratios and readable typography

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 13+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Animations**: CSS transitions and transforms

### Planned Integrations
- **Database**: MongoDB (for customer data and CRM)
- **SMS**: Twilio (for messaging functionality)
- **Payments**: Stripe (for online payments)
- **Analytics**: Google Analytics
- **Calendar**: Google Calendar integration

## 📁 Project Structure+

```
dopecuts/
├── app/                    # Next.js App Router pages
│   ├── about/             # About page
│   ├── admin/             # Admin dashboard
│   ├── book/              # Booking system
│   ├── contact/           # Contact page
│   ├── gallery/           # Portfolio gallery
│   ├── products/          # Product store
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # Reusable components
│   ├── ui/                # shadcn/ui components
│   ├── About.tsx          # About section
│   ├── BookingCTA.tsx     # Booking call-to-action
│   ├── Footer.tsx         # Site footer
│   ├── Hero.tsx           # Homepage hero
│   ├── Navigation.tsx     # Main navigation
│   └── Services.tsx       # Services section
├── lib/                   # Utilities and configuration
└── README.md             # Project documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/Callmecgrey/dopecuts.git]
   cd dopecuts
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 📱 Pages Overview

### 1. Homepage (`/`)
- Hero section with compelling messaging
- Services overview
- About section preview
- Call-to-action for booking

### 2. About (`/about`)
- Company story and mission
- Team member profiles
- Business values and philosophy

### 3. Booking (`/book`)
- Multi-step booking process
- Service selection with pricing
- Date and time picker
- Customer information form
- Payment options
- Booking confirmation

### 4. Admin Dashboard (`/admin`)
- Business metrics overview
- Appointment management
- Customer database (CRM)
- Analytics and reporting
- SMS messaging system
- Business settings

### 5. Gallery (`/gallery`)
- Portfolio of haircuts and styling
- Category filtering
- High-quality before/after images

### 6. Products (`/products`)
- Hair care product catalog
- Detailed product information
- Shopping cart functionality
- Professional recommendations

### 7. Contact (`/contact`)
- Contact form
- Business information
- Location map
- Operating hours

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file for environment-specific settings:

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# SMS Service
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone

# Payment Processing
STRIPE_PUBLIC_KEY=your_stripe_public_key
STRIPE_SECRET_KEY=your_stripe_secret_key

# Analytics
GOOGLE_ANALYTICS_ID=your_ga_id

# Email Service
EMAIL_HOST=your_email_host
EMAIL_USER=your_email_user
EMAIL_PASS=your_email_password
```

### Business Settings
Admin can configure:
- Business hours
- Service pricing
- Booking advance limit (default: 60 days)
- Cancellation deadline (default: 24 hours)
- SMS templates
- Blocked time slots

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deployment Options
- **Vercel**: Optimized for Next.js (recommended)
- **Netlify**: Static deployment with serverless functions
- **AWS**: Full control with S3 + CloudFront
- **Digital Ocean**: App Platform deployment

### Performance Optimizations
- Image optimization with Next.js Image component
- Font preloading for faster text rendering
- CSS optimization with Tailwind CSS
- Code splitting and lazy loading
- Static generation where applicable

## 📊 Analytics & Monitoring

### Planned Integrations
- **Google Analytics**: Track user behavior and conversions
- **Customer Analytics**: Booking patterns and preferences
- **Business Metrics**: Revenue tracking and appointment analytics
- **Performance Monitoring**: Page load times and user experience

## 🔒 Security Features

- **Input Validation**: All forms validated on client and server
- **Rate Limiting**: Prevent spam and abuse
- **Data Encryption**: Sensitive customer data protection
- **Secure Payments**: PCI-compliant payment processing
- **Access Control**: Role-based admin permissions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software for DopeCuts barbershop.