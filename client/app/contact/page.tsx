// dopecuts/app/contact/page.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { submitContactForm } from '@/lib/api/contactTicket';

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);
  const successRef = useRef<HTMLParagraphElement | null>(null);

  // auto-clear success after a short delay (optional, tweak as desired)
  useEffect(() => {
    if (!okMsg) return;
    const t = setTimeout(() => {
      setOkMsg(null);
      setTicketId(null);
    }, 8000);
    return () => clearTimeout(t);
  }, [okMsg]);

  // shared field styles
  const field =
    'mt-2 bg-gray-900 text-white placeholder-gray-400 border-gray-700 ' +
    'focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOkMsg(null);
    setErrMsg(null);
    setTicketId(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const data = {
      firstName: String(fd.get('firstName') || '').trim(),
      lastName: String(fd.get('lastName') || '').trim() || undefined,
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim() || undefined,
      subject: String(fd.get('subject') || '').trim(),
      message: String(fd.get('message') || '').trim(),
    };

    if (!data.firstName || !data.email || !data.subject || !data.message) {
      setErrMsg('Please fill in first name, email, subject, and message.');
      return;
    }

    setLoading(true);
    try {
      const resp = await submitContactForm(data);
      setOkMsg(resp.message || 'Message received. We will get back to you shortly.');
      setTicketId(resp.ticketId ?? null);

      // reset the form fields
      form.reset();

      // move focus to the success text and scroll it into view
      requestAnimationFrame(() => {
        successRef.current?.focus();
        successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (err: any) {
      const apiMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send message. Please try again.';
      setErrMsg(apiMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 py-16">
      <div className="container-max section-padding">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-6">Contact Us</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get in touch with us for appointments, questions, or just to say hello.
            We're here to help you look your best.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Information */}
          <div className="space-y-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <MapPin className="h-5 w-5" />
                  Location
                </CardTitle>
                <CardDescription className="text-gray-300">
                  DopeCuts (inside Elite Barber)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  646 Upper James Street<br />
                  Hamilton ON<br />
                  L9C 2Z2
                </p>
                <Button variant="outline" asChild>
                  <a
                    href="https://maps.google.com/?q=646+Upper+James+Street+Hamilton+ON+L9C+2Z2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get Directions
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Phone className="h-5 w-5" />
                  Phone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">(365) 323-3680</p>
                <p className="text-sm text-gray-400">
                  Call us to book an appointment or ask any questions
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Mail className="h-5 w-5" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">leeroy@dopecuts.ca</p>
                <p className="text-sm text-gray-400">
                  Send us an email and we'll get back to you within 24 hours
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Clock className="h-5 w-5" />
                  Business Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-gray-300">
                  <div className="flex justify-between">
                    <span>Monday - Friday:</span>
                    <span>11:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday:</span>
                    <span>10:00 AM - 7:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday:</span>
                    <span>Closed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Send us a Message</CardTitle>
              <CardDescription className="text-gray-300">
                Have a question or special request? We'd love to hear from you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                ref={formRef}
                className="space-y-6"
                onSubmit={onSubmit}
                aria-busy={loading}
                noValidate
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-white">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      autoComplete="given-name"
                      className={field}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-white">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      autoComplete="family-name"
                      className={field}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className={field}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-white">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    className={field}
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="subject" className="text-white">Subject</Label>
                <Input
                    id="subject"
                    name="subject"
                    className={field}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="message" className="text-white">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Tell us how we can help you..."
                    className={`${field} min-h-[120px]`}
                    required
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Message'}
                </Button>

                {/* Status messages */}
                {okMsg && (
                  <p
                    ref={successRef}
                    className="text-green-400"
                    role="status"
                    aria-live="polite"
                    tabIndex={-1}
                  >
                    {okMsg}{ticketId ? ` (Ticket #${ticketId})` : ''}
                  </p>
                )}
                {errMsg && (
                  <p className="text-red-400" role="alert" aria-live="assertive">
                    {errMsg}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Map Section */}
        <div className="mt-16">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Find Us - DopeCuts (inside Elite Barber)</CardTitle>
              <CardDescription className="text-gray-300">
                Located in the heart of the city, easy to find and plenty of parking available.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-gray-700">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2906.697046113586!2d-79.88106318824609!3d43.236811079141766!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xa78622274e13fef1%3A0xe76daa437e63a473!2sElite%20Barber!5e0!3m2!1sen!2sca!4v1757799419684!5m2!1sen!2sca"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  className="w-full h-full"
                  style={{ border: 0 }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}