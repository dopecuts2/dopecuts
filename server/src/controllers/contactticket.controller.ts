// dopecut/dopecuts-server-main/src/controllers/contact.controller.ts
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ContactTicket } from '../models/contactTicket.model';
import { sendContactAcknowledgementEmail, sendAdminContactNotificationEmail, sendCustomEmailToCustomer } from '../services/emailService';

// Public: submit contact form
export const submitContact = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, subject, message } = req.body || {};
    if (!firstName || !email || !subject || !message) {
      return res.status(400).json({ message: 'firstName, email, subject, and message are required' });
    }

    const ticket = await ContactTicket.create({
      firstName,
      lastName,
      email,
      phone,
      subject,
      message,
      status: 'open',
      meta: {
        ip: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
        source: 'web',
      },
    });

    // Fire-and-forget emails (no need to block response)
    void sendContactAcknowledgementEmail({
      email,
      firstName,
      subject,
    });
    void sendAdminContactNotificationEmail(ticket);

    return res.status(201).json({
      message: 'Message received. We will get back to you shortly.',
      ticketId: ticket._id,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit message' });
  }
};

// Admin: list with filters/pagination
export const adminListTickets = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10), 1), 100);
    const status = (req.query.status as string) || undefined;
    const q = (req.query.q as string) || undefined;
    const sort = (req.query.sort as string) || 'createdAt:desc';

    const filter: any = {};
    if (status) filter.status = status;

    if (q) {
      // prefer $text if available; fallback to regex OR
      filter.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
        { message: { $regex: q, $options: 'i' } },
      ];
    }

    const [sortField, sortDir] = sort.split(':');
    const sortObj: any = { [sortField || 'createdAt']: sortDir === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      ContactTicket.find(filter).sort(sortObj).skip((page - 1) * limit).limit(limit).lean(),
      ContactTicket.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch tickets' });
  }
};

// Admin: get by id
export const adminGetTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const ticket = await ContactTicket.findById(id).lean();
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    return res.status(200).json(ticket);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch ticket' });
  }
};

// Admin: respond (send email + record)
export const adminRespondToTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body || {};

    if (!subject || !message) {
      return res.status(400).json({ message: 'subject and message are required' });
    }
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const ticket = await ContactTicket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // send email to customer
    const emailRes = await sendCustomEmailToCustomer(ticket.email, subject, message);
    // Record the response regardless of email provider status
    ticket.responses.push({
      subject,
      message,
      sentAt: new Date(),
      sentBy: req.admin ? new Types.ObjectId(req.admin._id) : undefined,
    });

    // Mark as answered if not closed
    if (ticket.status !== 'closed') ticket.status = 'answered';

    await ticket.save();

    return res.status(200).json({
      message: emailRes?.success ? 'Response sent' : 'Response recorded (email not sent)',
      ticket,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to respond to ticket' });
  }
};

// Admin: close ticket (optional closing note/email)
export const adminCloseTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note, notifyCustomer, subject, message } = req.body || {};
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const ticket = await ContactTicket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (note) {
      ticket.adminNotes = ticket.adminNotes ? `${ticket.adminNotes}\n${note}` : note;
    }

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedBy = req.admin ? new Types.ObjectId(req.admin._id) : null;

    // Optional notify
    if (notifyCustomer && subject && message) {
      const emailRes = await sendCustomEmailToCustomer(ticket.email, subject, message);
      ticket.responses.push({
        subject,
        message,
        sentAt: new Date(),
        sentBy: req.admin ? new Types.ObjectId(req.admin._id) : undefined,
      });
      await ticket.save();
      return res.status(200).json({
        message: emailRes?.success ? 'Ticket closed and customer notified' : 'Ticket closed (email not sent)',
        ticket,
      });
    }

    await ticket.save();
    return res.status(200).json({ message: 'Ticket closed', ticket });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to close ticket' });
  }
};