// dopecuts/app/admin/contact-tickets/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listContactTickets,
  getContactTicket,
  respondToContactTicket,
  closeContactTicket,
  type ContactTicket,
  type ContactStatus,
} from '@/lib/api/contactTicket';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Mail, MessageSquareMore, Reply, XCircle, RefreshCcw } from 'lucide-react';

// ---- Helpers ----

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function statusBadgeColor(status: ContactStatus) {
  switch (status) {
    case 'open':
      return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30';
    case 'answered':
      return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30';
    case 'closed':
      return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30';
  }
}

// ---- Page Component ----

export default function AdminContactTicketsPage() {
  // list state
  const [tickets, setTickets] = useState<ContactTicket[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState('createdAt:desc');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('');
  const [q, setQ] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);

  // detail & dialog state
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContactTicket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  // respond state
  const respondDefaultSubject = useMemo(
    () => (detail ? `Re: ${detail.subject}` : ''),
    [detail]
  );
  const [respSubject, setRespSubject] = useState('');
  const [respMessage, setRespMessage] = useState('');
  const [sendingResp, setSendingResp] = useState(false);
  const [respOk, setRespOk] = useState<string | null>(null);
  const [respErr, setRespErr] = useState<string | null>(null);

  // close state
  const [closeNote, setCloseNote] = useState('');
  const [notify, setNotify] = useState(false);
  const [closeSubject, setCloseSubject] = useState('');
  const [closeMessage, setCloseMessage] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeOk, setCloseOk] = useState<string | null>(null);
  const [closeErr, setCloseErr] = useState<string | null>(null);

  // load list
  async function loadList(opts?: { keepPage?: boolean }) {
    setLoadingList(true);
    setListErr(null);
    try {
      const res = await listContactTickets({
        page: opts?.keepPage ? page : 1,
        limit,
        status: statusFilter || undefined,
        q: q || undefined,
        sort,
      });
      setTickets(res.items);
      setPage(res.page);
      setPages(res.pages);
      setTotal(res.total);
    } catch (err: any) {
      setListErr(
        err?.response?.data?.message || err?.message || 'Failed to load tickets.'
      );
    } finally {
      setLoadingList(false);
    }
  }

  // load detail
  async function loadDetail(id: string) {
    setLoadingDetail(true);
    setDetailErr(null);
    try {
      const t = await getContactTicket(id);
      setDetail(t);
      // initialize respond defaults for convenience
      setRespSubject(`Re: ${t.subject}`);
      setRespMessage('');
      // initialize close defaults
      setCloseNote('');
      setNotify(false);
      setCloseSubject(`Regarding your ticket: ${t.subject}`);
      setCloseMessage('');
      setRespOk(null);
      setRespErr(null);
      setCloseOk(null);
      setCloseErr(null);
    } catch (err: any) {
      setDetailErr(
        err?.response?.data?.message || err?.message || 'Failed to load ticket.'
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  // open dialog handler
  function openDialogFor(id: string) {
    setDetailId(id);
    setOpen(true);
  }

  // when dialog opens, fetch detail
  useEffect(() => {
    if (open && detailId) {
      loadDetail(detailId);
    } else if (!open) {
      // clear detail when closing
      setDetail(null);
      setDetailId(null);
      setDetailErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, detailId]);

  // reload list when filters change
  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, sort, statusFilter]);

  // search throttled trigger
  useEffect(() => {
    const t = setTimeout(() => {
      loadList();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // pagination jump
  async function goToPage(next: number) {
    if (next < 1 || next > pages) return;
    setLoadingList(true);
    setListErr(null);
    try {
      const res = await listContactTickets({
        page: next,
        limit,
        status: statusFilter || undefined,
        q: q || undefined,
        sort,
      });
      setTickets(res.items);
      setPage(res.page);
      setPages(res.pages);
      setTotal(res.total);
    } catch (err: any) {
      setListErr(
        err?.response?.data?.message || err?.message || 'Failed to load tickets.'
      );
    } finally {
      setLoadingList(false);
    }
  }

  // respond handler
  async function onRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!respSubject.trim() || !respMessage.trim()) {
      setRespErr('Subject and message are required.');
      return;
    }
    setSendingResp(true);
    setRespErr(null);
    setRespOk(null);
    try {
      const res = await respondToContactTicket(detail._id, {
        subject: respSubject.trim(),
        message: respMessage.trim(),
      });
      setRespOk(res.message || 'Response sent.');
      setDetail(res.ticket);
      // update list row in place
      setTickets((prev) =>
        prev.map((t) => (t._id === res.ticket._id ? res.ticket : t))
      );
      // clear message box but keep subject for follow-ups
      setRespMessage('');
    } catch (err: any) {
      setRespErr(
        err?.response?.data?.message || err?.message || 'Failed to send response.'
      );
    } finally {
      setSendingResp(false);
    }
  }

  // close handler
  async function onCloseTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (notify && (!closeSubject.trim() || !closeMessage.trim())) {
      setCloseErr('Subject and message are required when notifying the customer.');
      return;
    }
    setClosing(true);
    setCloseErr(null);
    setCloseOk(null);
    try {
      const res = await closeContactTicket(detail._id, {
        note: closeNote.trim() || undefined,
        notifyCustomer: notify || undefined,
        subject: notify ? closeSubject.trim() : undefined,
        message: notify ? closeMessage.trim() : undefined,
      });
      setCloseOk(res.message || 'Ticket closed.');
      setDetail(res.ticket);
      // update list row
      setTickets((prev) =>
        prev.map((t) => (t._id === res.ticket._id ? res.ticket : t))
      );
    } catch (err: any) {
      setCloseErr(
        err?.response?.data?.message || err?.message || 'Failed to close ticket.'
      );
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 py-10">
      <div className="container-max section-padding space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Contact Tickets</h1>
            <p className="text-gray-300">
              View, respond, and close customer inquiries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => loadList({ keepPage: true })}
              disabled={loadingList}
            >
              {loadingList ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </header>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="gap-4">
            <CardTitle className="text-white">All Tickets</CardTitle>
            <CardDescription className="text-gray-300">
              Use search and filters to narrow results. Click &ldquo;View&rdquo; to manage a ticket.
            </CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="md:col-span-2">
                <Label htmlFor="q" className="text-white">Search</Label>
                <Input
                  id="q"
                  placeholder="Search by subject, name, email, message…"
                  className="mt-2 bg-gray-900 text-white placeholder-gray-400 border-gray-700 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="status" className="text-white">Status</Label>
                <select
                  id="status"
                  className="mt-2 w-full rounded-md bg-gray-900 text-white border border-gray-700 px-3 py-2 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ContactStatus | '')}
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="answered">Answered</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="limit" className="text-white">Per page</Label>
                  <select
                    id="limit"
                    className="mt-2 w-full rounded-md bg-gray-900 text-white border border-gray-700 px-3 py-2 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="sort" className="text-white">Sort</Label>
                  <select
                    id="sort"
                    className="mt-2 w-full rounded-md bg-gray-900 text-white border border-gray-700 px-3 py-2 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="createdAt:desc">Newest</option>
                    <option value="createdAt:asc">Oldest</option>
                    <option value="updatedAt:desc">Recently updated</option>
                    <option value="updatedAt:asc">Least recently updated</option>
                  </select>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto rounded-md border border-gray-700">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Subject</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Updated</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-gray-800">
                  {tickets.map((t) => (
                    <tr key={t._id} className="hover:bg-gray-700/40">
                      <td className="px-4 py-3 align-top">
                        <div className="text-white font-medium line-clamp-2">{t.subject}</div>
                        <div className="text-gray-400 text-sm line-clamp-1">{t.message}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-white">
                          {t.firstName} {t.lastName || ''}
                        </div>
                        <div className="text-gray-400 text-sm flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{t.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusBadgeColor(t.status)
                          )}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-300 text-sm">{fmtDate(t.createdAt)}</td>
                      <td className="px-4 py-3 align-top text-gray-300 text-sm">{fmtDate(t.updatedAt)}</td>
                      <td className="px-4 py-3 align-top text-right">
                        <Button
                          variant="secondary"
                          className="bg-gray-700 text-white hover:bg-gray-600"
                          onClick={() => openDialogFor(t._id)}
                        >
                          <MessageSquareMore className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {tickets.length === 0 && !loadingList && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                        No tickets found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {listErr && (
              <p className="mt-3 text-sm text-rose-300" role="alert">
                {listErr}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="text-gray-300 text-sm">
                Showing page <span className="text-white font-medium">{page}</span> of{' '}
                <span className="text-white font-medium">{pages}</span> —{' '}
                <span className="text-white font-medium">{total}</span> total
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={page <= 1 || loadingList} onClick={() => goToPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" disabled={page >= pages || loadingList} onClick={() => goToPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Fixed-height dialog with reliable inline scroll via CSS grid */}
        <DialogContent className="sm:max-w-3xl h-[80vh] bg-gray-800 border border-gray-700 text-white p-0 grid grid-rows-[auto,1fr,auto] overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-700">
            <DialogTitle className="text-white">
              {detail ? detail.subject : 'Ticket'}
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              {detail ? `From ${detail.firstName}${detail.lastName ? ' ' + detail.lastName : ''} • ${detail.email}` : 'Loading…'}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable content area */}
          <div className="px-6 py-4 overflow-y-auto min-h-0">
            {loadingDetail && (
              <div className="flex items-center gap-2 py-6 text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading ticket…
              </div>
            )}

            {!loadingDetail && detailErr && (
              <p className="text-rose-300" role="alert">
                {detailErr}
              </p>
            )}

            {!loadingDetail && detail && (
              <div className="space-y-6">
                {/* Top meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400">Status</div>
                    <div>
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          statusBadgeColor(detail.status)
                        )}
                      >
                        {detail.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Created</div>
                    <div className="text-gray-200">{fmtDate(detail.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Updated</div>
                    <div className="text-gray-200">{fmtDate(detail.updatedAt)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Phone</div>
                    <div className="text-gray-200">{detail.phone || '—'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-400">Message</div>
                    <div className="text-gray-100 whitespace-pre-wrap bg-gray-900/60 rounded-md p-3 border border-gray-700 mt-1">
                      {detail.message}
                    </div>
                  </div>
                  {detail.adminNotes && (
                    <div className="col-span-2">
                      <div className="text-gray-400">Admin Notes</div>
                      <div className="text-gray-100 whitespace-pre-wrap bg-gray-900/60 rounded-md p-3 border border-gray-700 mt-1">
                        {detail.adminNotes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Responses timeline */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Responses</h3>
                  {detail.responses?.length ? (
                    <div className="space-y-3">
                      {[...detail.responses].reverse().map((r, idx) => (
                        <div key={idx} className="rounded-md border border-gray-700 bg-gray-900/50 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="text-gray-300">
                              <span className="font-medium text-white">{r.subject}</span>
                            </div>
                            <div className="text-gray-400">{fmtDate(r.sentAt)}</div>
                          </div>
                          <div className="mt-2 text-gray-100 whitespace-pre-wrap">{r.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No responses yet.</p>
                  )}
                </div>

                {/* Respond form */}
                <form onSubmit={onRespond} className="space-y-3 rounded-md border border-gray-700 p-4 bg-gray-900/40">
                  <div className="flex items-center gap-2">
                    <Reply className="h-4 w-4 text-gray-300" />
                    <h3 className="text-lg font-semibold">Respond</h3>
                  </div>
                  <div>
                    <Label htmlFor="respSubject" className="text-white">Subject</Label>
                    <Input
                      id="respSubject"
                      value={respSubject}
                      onChange={(e) => setRespSubject(e.target.value)}
                      className="mt-2 bg-gray-900 text-white placeholder-gray-400 border-gray-700 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                      placeholder="Subject"
                      disabled={sendingResp || detail.status === 'closed'}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="respMessage" className="text-white">Message</Label>
                    <Textarea
                      id="respMessage"
                      value={respMessage}
                      onChange={(e) => setRespMessage(e.target.value)}
                      className="mt-2 bg-gray-900 text-white placeholder-gray-400 border-gray-700 min-h-[120px] focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                      placeholder="Write your reply…"
                      disabled={sendingResp || detail.status === 'closed'}
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      {respOk && <p className="text-emerald-300">{respOk}</p>}
                      {respErr && <p className="text-rose-300" role="alert">{respErr}</p>}
                    </div>
                    <Button type="submit" disabled={sendingResp || detail.status === 'closed'}>
                      {sendingResp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Reply className="mr-2 h-4 w-4" />}
                      Send Response
                    </Button>
                  </div>
                </form>

                {/* Close form */}
                <form onSubmit={onCloseTicket} className="space-y-3 rounded-md border border-gray-700 p-4 bg-gray-900/40">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-gray-300" />
                    <h3 className="text-lg font-semibold">Close Ticket</h3>
                  </div>

                  <div>
                    <Label htmlFor="closeNote" className="text-white">Internal Note (optional)</Label>
                    <Textarea
                      id="closeNote"
                      value={closeNote}
                      onChange={(e) => setCloseNote(e.target.value)}
                      className="mt-2 bg-gray-900 text-white placeholder-gray-400 border-gray-700 min-h-[80px] focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                      placeholder="Add an internal note…"
                      disabled={closing || detail.status === 'closed'}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="notify"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-white focus:ring-white/20"
                      checked={notify}
                      onChange={(e) => setNotify(e.target.checked)}
                      disabled={closing || detail.status === 'closed'}
                    />
                    <Label htmlFor="notify" className="text-white">Notify customer on close</Label>
                  </div>

                  {notify && (
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label htmlFor="closeSubject" className="text-white">Email Subject</Label>
                        <Input
                          id="closeSubject"
                          value={closeSubject}
                          onChange={(e) => setCloseSubject(e.target.value)}
                          className="mt-2 bg-gray-900 text-white placeholder-gray-400 border-gray-700 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                          placeholder="Subject"
                          disabled={closing || detail.status === 'closed'}
                          required={notify}
                        />
                      </div>
                      <div>
                        <Label htmlFor="closeMessage" className="text-white">Email Message</Label>
                        <Textarea
                          id="closeMessage"
                          value={closeMessage}
                          onChange={(e) => setCloseMessage(e.target.value)}
                          className="mt-2 bg-gray-900 text-white placeholder-gray-400 border-gray-700 min-h-[120px] focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:border-gray-400"
                          placeholder="Write the closing message…"
                          disabled={closing || detail.status === 'closed'}
                          required={notify}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      {closeOk && <p className="text-emerald-300">{closeOk}</p>}
                      {closeErr && <p className="text-rose-300" role="alert">{closeErr}</p>}
                    </div>
                    <Button
                      type="submit"
                      variant="destructive"
                      className="bg-rose-600 hover:bg-rose-500"
                      disabled={closing || detail.status === 'closed'}
                    >
                      {closing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                      Close Ticket
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-700">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}