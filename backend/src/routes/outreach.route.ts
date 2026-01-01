import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { emailFinderService } from '../services/email-finder.service';
import { emailSenderService } from '../services/email-sender.service';
import { logger } from '../utils/logger.util';

const router = Router();

const findEmailSchema = z.object({
    domain: z.string(),
    companyName: z.string(),
});

const sendEmailSchema = z.object({
    to: z.string().email(),
    subject: z.string(),
    html: z.string(),
});

// POST /api/outreach/find-email
router.post('/find-email', async (req: Request, res: Response) => {
    try {
        const { domain, companyName } = findEmailSchema.parse(req.body);
        const result = await emailFinderService.findEmail(domain, companyName);

        if (result) {
            res.json(result);
        } else {
            res.status(404).json({ error: 'Email not found' });
        }
    } catch (error) {
        logger.error('Find email error', error);
        res.status(400).json({ error: 'Invalid request' });
    }
});

// POST /api/outreach/send-email
router.post('/send-email', async (req: Request, res: Response) => {
    try {
        const { to, subject, html } = sendEmailSchema.parse(req.body);

        // In a real app, we'd check if the user has credits or an active subscription here

        const result = await emailSenderService.sendEmail(to, subject, html);

        if (result.success) {
            res.json({ success: true, id: result.id });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Send email error', error);
        res.status(400).json({ error: 'Invalid request' });
    }
});

export { router as outreachRouter };
