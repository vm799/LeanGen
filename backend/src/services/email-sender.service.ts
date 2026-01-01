import { Resend } from 'resend';
import { logger } from '../utils/logger.util';

class EmailSenderService {
    private resend: Resend;
    private initialized = false;

    constructor() {
        const key = process.env.RESEND_API_KEY;
        if (key) {
            this.resend = new Resend(key);
            this.initialized = true;
        } else {
            logger.warn('RESEND_API_KEY not found. Email sending will be disabled.');
        }
    }

    async sendEmail(to: string, subject: string, html: string) {
        if (!this.initialized) {
            logger.warn(`Email sending skipped (no API key). To: ${to}`);
            return { success: false, error: 'Service not configured' };
        }

        try {
            const data = await this.resend.emails.send({
                from: 'LeadGenius <onboarding@resend.dev>', // Should be configurable
                to,
                subject,
                html,
            });

            logger.info(`Email sent to ${to}: ${data.data?.id}`);
            return { success: true, id: data.data?.id };
        } catch (error) {
            logger.error(`Error sending email to ${to}: ${error}`);
            return { success: false, error };
        }
    }
}

export const emailSenderService = new EmailSenderService();
