import { Router, Request, Response } from 'express';
import { HealthCheck } from '../types';
import { placesService } from '../services/places.service';
import { geminiService } from '../services/gemini.service';
import { searchService } from '../services/search.service';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger.util';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check Google Maps/Places API
  try {
    const start = Date.now();
    const isHealthy = await placesService.healthCheck();
    const responseTime = Date.now() - start;

    health.services.maps = {
      status: isHealthy ? 'up' : 'down',
      responseTime,
      ...(isHealthy
        ? {}
        : { error: 'Maps API not responding. Check API key and billing.' }),
    };

    if (!isHealthy) health.status = 'degraded';
  } catch (error) {
    health.services.maps = {
      status: 'down',
      error: 'Maps API check failed',
    };
    health.status = 'degraded';
  }

  // Check Gemini API
  try {
    const start = Date.now();
    const isHealthy = await geminiService.healthCheck();
    const responseTime = Date.now() - start;

    health.services.gemini = {
      status: isHealthy ? 'up' : 'down',
      responseTime,
      ...(isHealthy ? {} : { error: 'Gemini API unavailable' }),
    };

    if (!isHealthy) health.status = 'degraded';
  } catch (error) {
    health.services.gemini = {
      status: 'down',
      error: 'Gemini API check failed',
    };
    health.status = 'degraded';
  }

  // Check Google Search API (optional)
  try {
    const isHealthy = await searchService.healthCheck();
    health.services.search = {
      status: isHealthy ? 'up' : 'down',
      ...(isHealthy ? {} : { error: 'Search API unavailable' }),
    };
    // Don't change health status for search - it's optional
  } catch (error) {
    health.services.search = {
      status: 'down',
      error: 'Search API check failed',
    };
  }

  // Check Redis
  try {
    const isHealthy = await cacheService.ping();
    health.services.cache = {
      status: isHealthy ? 'up' : 'down',
      ...(isHealthy
        ? {}
        : { error: 'Redis unavailable - caching disabled' }),
    };
    // Don't change health status for cache - app can work without it
  } catch (error) {
    health.services.cache = {
      status: 'down',
      error: 'Cache check failed',
    };
  }

  // Get usage stats
  try {
    const today = new Date().toISOString().split('T')[0];
    const usage = {
      placesSearchToday:
        (await cacheService.get<number>(`usage:placesSearch:${today}`)) || 0,
      placeDetailsToday:
        (await cacheService.get<number>(`usage:placeDetails:${today}`)) || 0,
      geminiCallsToday:
        (await cacheService.get<number>(`usage:gemini:${today}`)) || 0,
      searchQueriesToday:
        (await cacheService.get<number>(`usage:search:${today}`)) || 0,
    };
    health.usage = usage;
  } catch (error) {
    logger.error(`Failed to get usage stats: ${error}`);
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

export { router as healthRouter };
