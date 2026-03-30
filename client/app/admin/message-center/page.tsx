'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getAllContacts, IContact } from '@/lib/api/contact';
import { sendMessageCampaign } from '@/lib/api/messageCenter';
import { toast } from 'sonner';
import {
  Mail,
  Search,
  Send,
  Smartphone,
  Users,
  Loader2,
} from 'lucide-react';

type RecipientScope = 'selected' | 'all';

export default function MessageCenterPage() {
  const [contacts, setContacts] = useState<IContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [recipientScope, setRecipientScope] = useState<RecipientScope>('selected');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsBody, setSmsBody] = useState('');

  const fetchContacts = async () => {
    setIsLoadingContacts(true);
    setLoadError(null);
    try {
      const data = await getAllContacts();
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts', error);
      setLoadError('Unable to load contacts right now.');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return contacts
      .filter((contact) => {
        if (!normalizedQuery) return true;
        return (
          contact.name.toLowerCase().includes(normalizedQuery) ||
          contact.email.toLowerCase().includes(normalizedQuery) ||
          contact.phone.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, searchQuery]);

  const recipients =
    recipientScope === 'all'
      ? contacts
      : contacts.filter((contact) => selectedContactIds.includes(contact._id));

  const visibleSelectionIsFull =
    filteredContacts.length > 0 &&
    filteredContacts.every((contact) => selectedContactIds.includes(contact._id));

  const toggleContactSelection = (contactId: string, value?: boolean) => {
    setSelectedContactIds((prev) => {
      const alreadySelected = prev.includes(contactId);
      const shouldSelect = value ?? !alreadySelected;
      if (shouldSelect) {
        return alreadySelected ? prev : [...prev, contactId];
      }
      return prev.filter((id) => id !== contactId);
    });
  };

  const handleSelectVisible = () => {
    const visibleIds = filteredContacts.map((contact) => contact._id);
    if (visibleSelectionIsFull) {
      setSelectedContactIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedContactIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleSendMessages = async () => {
    if (!sendEmail && !sendSms) {
      toast.error('Choose at least one channel (email or SMS).');
      return;
    }

    if (recipientScope === 'selected' && selectedContactIds.length === 0) {
      toast.error('Select at least one recipient.');
      return;
    }

    if (recipientScope === 'all' && contacts.length === 0) {
      toast.error('You have no contacts to message yet.');
      return;
    }

    if (sendEmail && (!emailSubject.trim() || !emailBody.trim())) {
      toast.error('Email messages require a subject and body.');
      return;
    }

    if (sendSms && !smsBody.trim()) {
      toast.error('SMS messages require a message.');
      return;
    }

    const payload = {
      sendToAll: recipientScope === 'all',
      ...(recipientScope === 'selected' && { contactIds: selectedContactIds }),
      ...(sendEmail && {
        email: {
          subject: emailSubject.trim(),
          message: emailBody.trim(),
        },
      }),
      ...(sendSms && {
        sms: {
          message: smsBody.trim(),
        },
      }),
    };

    try {
      setIsSending(true);
      const response = await sendMessageCampaign(payload);
      const channelSummaries: string[] = [];
      if (response.email) {
        channelSummaries.push(
          `Email ${response.email.succeeded}/${response.email.attempted}`
        );
      }
      if (response.sms) {
        channelSummaries.push(`SMS ${response.sms.succeeded}/${response.sms.attempted}`);
      }

      const summary = channelSummaries.length
        ? `${channelSummaries.join(' • ')}`
        : `${response.totalRecipients} recipient${response.totalRecipients === 1 ? '' : 's'}`;

      toast.success(`Messages queued (${summary})`);
      setEmailSubject('');
      setEmailBody('');
      setSmsBody('');
      setSelectedContactIds([]);
      setRecipientScope('selected');
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || (error as Error)?.message || 'Failed to send messages.';
      toast.error(errorMessage);
      console.error('Message center error', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Badge variant="secondary" className="px-2 py-0.5">
            Admin-Only
          </Badge>
          <span>Compose SMS and email campaigns from one place.</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-white">Message Center</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            Pull in your contacts, select recipients or message everyone, and choose whether to send
            email, SMS, or both. Messages are dispatched through the DopeCuts notification stack.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-white text-lg">
                <Users className="h-5 w-5 text-gray-300" />
                Recipients
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchContacts}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Refresh
              </Button>
            </div>
            <CardDescription className="text-gray-400 text-sm">
              Select recipients manually or send to all customers at once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant={recipientScope === 'selected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecipientScope('selected')}
              >
                Selected ({selectedContactIds.length})
              </Button>
              <Button
                variant={recipientScope === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecipientScope('all')}
                disabled={contacts.length === 0}
              >
                All Customers ({contacts.length})
              </Button>
              <Badge className="bg-white/10 text-white">
                {recipientScope === 'all' ? contacts.length : selectedContactIds.length}{' '}
                recipients chosen
              </Badge>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Search name, email, or phone"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10 bg-gray-900 border-gray-700 text-white"
                />
              </div>
              <div className="flex gap-2 text-xs uppercase tracking-widest text-gray-500">
                <Button variant="ghost" size="sm" onClick={handleSelectVisible}>
                  {visibleSelectionIsFull ? 'Unselect visible' : 'Select visible'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedContactIds([])}
                  disabled={selectedContactIds.length === 0}
                >
                  Clear selection
                </Button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-700">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-900/40">
                    <TableHead className="w-12 text-gray-400">Select</TableHead>
                    <TableHead className="text-gray-400">Name</TableHead>
                    <TableHead className="text-gray-400">Email</TableHead>
                    <TableHead className="text-gray-400">Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingContacts ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                        Loading contacts...
                      </TableCell>
                    </TableRow>
                  ) : filteredContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                        {loadError || 'No contacts match your search.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContacts.map((contact) => {
                      const isSelected = selectedContactIds.includes(contact._id);
                      return (
                        <TableRow
                          key={contact._id}
                          className={cn(
                            'hover:bg-white/5 transition-colors',
                            isSelected && 'bg-white/10'
                          )}
                        >
                          <TableCell className="text-white">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleContactSelection(contact._id, Boolean(checked))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-white">{contact.name}</TableCell>
                          <TableCell className="text-gray-300">{contact.email}</TableCell>
                          <TableCell className="text-gray-300">{contact.phone}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <Mail className="h-5 w-5 text-rose-400" />
              Message composer
            </CardTitle>
            <CardDescription className="text-gray-400 text-sm">
              Provide content for the selected channels. Email requires a subject and full body,
              whereas SMS only uses the message field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Checkbox checked={sendEmail} onCheckedChange={(checked) => setSendEmail(Boolean(checked))} />
                <span className="text-sm text-white flex items-center gap-1">
                  <Mail className="h-4 w-4 text-emerald-300" />
                  Email
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={sendSms} onCheckedChange={(checked) => setSendSms(Boolean(checked))} />
                <span className="text-sm text-white flex items-center gap-1">
                  <Smartphone className="h-4 w-4 text-sky-300" />
                  SMS
                </span>
              </div>
            </div>
            {sendEmail && (
              <div className="space-y-2">
                <Label htmlFor="mc-email-subject" className="text-white text-sm font-medium">
                  Email Subject
                </Label>
                <Input
                  id="mc-email-subject"
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  placeholder="e.g. Exclusive update from DopeCuts"
                  className="bg-gray-900 border-gray-700 text-white"
                />
                <Label htmlFor="mc-email-body" className="text-white text-sm font-medium">
                  Email Body
                </Label>
                <Textarea
                  id="mc-email-body"
                  rows={5}
                  value={emailBody}
                  onChange={(event) => setEmailBody(event.target.value)}
                  placeholder="Write the email message here..."
                  className="bg-gray-900 border-gray-700 text-white text-sm"
                />
              </div>
            )}
            {sendSms && (
              <div className="space-y-2">
                <Label htmlFor="mc-sms" className="text-white text-sm font-medium">
                  SMS Message
                </Label>
                <Textarea
                  id="mc-sms"
                  rows={4}
                  value={smsBody}
                  onChange={(event) => setSmsBody(event.target.value)}
                  placeholder="Keep it short and actionable. 480 characters max."
                  className="bg-gray-900 border-gray-700 text-white text-sm"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-gray-400">
                {recipientScope === 'all'
                  ? `Messages will be pushed to all ${contacts.length} customers.`
                  : `Messages will go to ${selectedContactIds.length} selected customer${
                      selectedContactIds.length === 1 ? '' : 's'
                    }.`}
              </div>
              <Button
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold"
                onClick={handleSendMessages}
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Messages
                  </>
                )}
              </Button>
              <div className="text-xs text-gray-500">
                Messages are queued sequentially to avoid hitting provider limits. Check the
                server logs for delivery outcomes.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
