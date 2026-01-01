import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { prisma } from '../utils/prisma.util';
import { logger } from '../utils/logger.util';

// Augment Express Request type to include auth
declare global {
    namespace Express {
        interface Request {
            auth: {
                userId: string;
                sessionId: string;
                orgId?: string;
            };
            user?: any; // We'll populate this from our DB
        }
    }
}

export const requireAuth = ClerkExpressRequireAuth({
    // options if needed
});

export const attachUser = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.userId) {
        return next();
    }

    try {
        let user = await prisma.user.findUnique({
            where: { id: req.auth.userId },
            include: { organization: true }
        });

        if (!user) {
            try {
                // Auto-provision user and organization for demo purposes
                const orgId = `org_${Math.random().toString(36).substr(2, 9)}`;
                await prisma.organization.create({
                    data: {
                        name: 'My Agency',
                        slug: `agency-${req.auth.userId.slice(0, 8)}`,
                        branding: {
                            primaryColor: '#4f46e5',
                            logoUrl: null
                        },
                        users: {
                            create: {
                                id: req.auth.userId,
                                email: `user_${req.auth.userId.slice(0, 8)}@example.com`,
                                role: 'ADMIN'
                            }
                        }
                    }
                });

                user = await prisma.user.findUnique({
                    where: { id: req.auth.userId },
                    include: { organization: true }
                });
            } catch (err) {
                logger.error(`Failed to auto-provision: ${err}`);
            }
        }

        if (user) {
            req.user = user;
        }
    } catch (error) {
        logger.error(`Error attaching user: ${error}`);
    }

    next();
};
