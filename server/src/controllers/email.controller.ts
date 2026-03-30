// dopecuts-server/src/controllers/email.controller.ts
import { Request, Response } from 'express';
import { sendCustomEmailToCustomer } from '../services/emailService';
import { logger } from '../utils/logger';

/**
 * @description Send a custom email to a customer.
 * @route POST /api/v1/email/send-custom
 * @access Private (Admin only)
 */
export const sendCustomEmail = async (req: Request, res: Response) => {
    const { email, subject, message } = req.body;

    if (!email || !subject || !message) {
        return res.status(400).json({ message: 'Email, subject, and message are required fields.' });
    }

    try {
        const result = await sendCustomEmailToCustomer(email, subject, message);
        if (result.success) {
            return res.status(200).json({ message: 'Email sent successfully.' });
        } else {
            // The service function already logs the error, but we can throw it to be caught here
            throw result.error;
        }
    } catch (error) {
        logger.error('Error sending custom email controller:', error);
        if (error instanceof Error) {
            return res.status(500).json({ message: 'Failed to send email.', error: error.message });
        }
        return res.status(500).json({ message: 'An unknown error occurred while sending the email.' });
    }
};