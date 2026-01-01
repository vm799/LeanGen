import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger.util';
import { leadsRouter } from './routes/leads.route';
import { outreachRouter } from './routes/outreach.route';
import { organizationRouter } from './routes/organization.route';
import { healthRouter } from './routes/health.route';
import { errorHandler } from './utils/error-handler.util';
import { requestLogger } from './utils/request-logger.util';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Authentication
import { requireAuth, attachUser } from './middleware/auth.middleware';
// Public routes (Health check)
app.use('/api/health', healthRouter);

// Protected routes
app.use('/api/*', requireAuth, attachUser);
app.use('/api/leads', leadsRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/organization', organizationRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 LeadGenius API running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
