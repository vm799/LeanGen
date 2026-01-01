import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.util';
import { logger } from '../utils/logger.util';

const router = Router();

const updateBrandingSchema = z.object({
    name: z.string().min(2).optional(),
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    logoUrl: z.string().url().optional(),
});

// GET /api/organization - Get current organization settings
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true }
        });

        if (!user?.organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        return res.json(user.organization);
    } catch (error) {
        logger.error('Get organization error', error);
        return res.status(500).json({ error: 'Failed to fetch organization' });
    }
});

// PATCH /api/organization - Update branding
router.patch('/', async (req: Request, res: Response) => {
    try {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name, primaryColor, logoUrl } = updateBrandingSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true }
        });

        if (!user?.organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const updatedOrg = await prisma.organization.update({
            where: { id: user.organization.id },
            data: {
                name: name || undefined,
                branding: {
                    primaryColor,
                    logoUrl
                }
            }
        });

        return res.json(updatedOrg);
    } catch (error) {
        logger.error('Update organization error', error);
        return res.status(400).json({ error: 'Invalid update request' });
    }
});

export { router as organizationRouter };
