import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  SearchParams,
  Lead,
  LeadsResponse,
  AnalysisResponse,
  ValidationError,
  NotFoundError,
} from '../types';
import { placesService } from '../services/places.service';
import { geminiService } from '../services/gemini.service';
import { scraperService } from '../services/scraper.service';
import { searchService } from '../services/search.service';
import { cacheService } from '../services/cache.service';
import { chatbotAnalyzer } from '../analyzers/chatbot.analyzer';
import { bookingAnalyzer } from '../analyzers/booking.analyzer';
import { sentimentAnalyzer } from '../analyzers/sentiment.analyzer';
import { seoAnalyzer } from '../analyzers/seo.analyzer';
import { logger } from '../utils/logger.util';
import { config } from '../config';

const router = Router();

// Validation schemas
const searchParamsSchema = z.object({
  industry: z.string().min(2).max(100),
  city: z.string().min(2).max(100),
  filters: z
    .object({
      minRating: z.number().min(1).max(5).optional(),
      maxRating: z.number().min(1).max(5).optional(),
      maxReviews: z.number().min(0).optional(),
      requireMissingChatbot: z.boolean().optional(),
      requireManualBooking: z.boolean().optional(),
      sentimentThreshold: z
        .enum(['POSITIVE', 'MIXED', 'NEGATIVE', 'ANY'])
        .optional(),
      radiusMiles: z.number().min(1).max(50).optional(),
    })
    .optional(),
});

// POST /api/leads - Fast initial search
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = searchParamsSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid search parameters: ${validationResult.error.message}`
      );
    }

    const params: SearchParams = validationResult.data;
    const { industry, city, filters } = params;

    logger.info(`Search request: ${industry} in ${city}`);

    // Check cache first
    const cacheKey = `leads:${industry}:${city}:${JSON.stringify(filters || {})}`;
    const cached = await cacheService.get<Lead[]>(cacheKey);

    if (cached) {
      logger.info(`Cache hit for: ${cacheKey}`);
      const response: LeadsResponse = {
        leads: cached,
        total: cached.length,
        cached: true,
      };
      return res.json(response);
    }

    // Track usage
    await trackUsage('placesSearch');

    // Search Google Places
    const places = await placesService.searchPlaces(industry, city, {
      minRating: filters?.minRating,
      maxRating: filters?.maxRating,
      maxResults: 20,
    });

    // Transform to Lead objects (lightweight - no analysis yet)
    const leads: Lead[] = places.map((place) => ({
      id: place.place_id,
      name: place.name,
      category: place.types?.[0] || null,
      address: place.formatted_address,
      rating: place.rating || null,
      reviewCount: place.user_ratings_total || null,
      location: place.geometry.location,
      mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      websiteUrl: null, // Will be fetched in detail analysis
      phone: null,
      analyzed: false,
    }));

    // Cache for 1 hour
    await cacheService.set(cacheKey, leads, config.cache.leadSearch);

    const response: LeadsResponse = {
      leads,
      total: leads.length,
      cached: false,
    };

    res.json(response);
  } catch (error) {
    logger.error(`Search error: ${error}`);
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Search failed' });
    }
  }
});

// POST /api/leads/:id/analyze - Deep analysis on demand
router.post('/:id/analyze', async (req: Request, res: Response) => {
  try {
    const { id: placeId } = req.params;

    if (!placeId) {
      throw new ValidationError('Place ID is required');
    }

    logger.info(`Analysis request for place: ${placeId}`);

    // Check cache
    const cacheKey = `analysis:${placeId}`;
    const cached = await cacheService.get<AnalysisResponse>(cacheKey);

    if (cached) {
      logger.info(`Analysis cache hit for: ${placeId}`);
      return res.json({ ...cached, cached: true });
    }

    // Get place details
    await trackUsage('placeDetails');
    const place = await placesService.getPlaceDetails(placeId);

    // Fetch website HTML if available
    let websiteHtml: string | null = null;
    if (place.website) {
      websiteHtml = await scraperService.fetchWebsite(place.website);
    }

    // Run analyzers in parallel
    const [chatbot, booking, sentiment, seo] = await Promise.all([
      chatbotAnalyzer.analyze(websiteHtml),
      bookingAnalyzer.analyze(websiteHtml),
      sentimentAnalyzer.analyze(place.reviews),
      seoAnalyzer.analyze(websiteHtml),
    ]);

    // Get Google Search results for additional context
    const searchResults = await searchService.searchBusinessReviews(
      place.name,
      place.formatted_address
    );

    // Build UX gaps list
    const uxGaps: string[] = [];
    if (!chatbot.hasChatbot) uxGaps.push('No AI chatbot for customer support');
    if (!booking.hasBooking) uxGaps.push('No online booking system');
    if (seo.gaps.length > 0) uxGaps.push(...seo.gaps.slice(0, 2));

    // Call Gemini for AI analysis
    await trackUsage('gemini');
    const aiAnalysis = await geminiService.analyzeBusinessOpportunity({
      name: place.name,
      industry: place.types?.[0] || 'business',
      city: place.formatted_address,
      rating: place.rating || 3.5,
      reviewCount: place.user_ratings_total || 0,
      recentReviews: place.reviews?.slice(0, 3).map((r) => r.text) || [],
      websiteHtml,
      hasChatbot: chatbot.hasChatbot,
      hasOnlineBooking: booking.hasBooking,
      uxGaps,
      googleSearchResults: searchResults,
    });

    const response: AnalysisResponse = {
      placeId,
      analysis: aiAnalysis,
      technicalDetails: {
        chatbot,
        booking,
        sentiment,
        seo,
      },
    };

    // Cache for 24 hours
    await cacheService.set(cacheKey, response, config.cache.leadAnalysis);

    res.json({ ...response, cached: false });
  } catch (error) {
    logger.error(`Analysis error: ${error}`);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Analysis failed' });
    }
  }
});

// Helper function to track API usage
async function trackUsage(service: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `usage:${service}:${today}`;

    const current = await cacheService.incr(key);
    await cacheService.expire(key, 86400); // 24 hours

    // Check rate limits
    const limits: Record<string, number> = {
      placesSearch: config.rateLimits.placesSearch,
      placeDetails: config.rateLimits.placeDetails,
      gemini: config.rateLimits.gemini,
      search: config.rateLimits.search,
    };

    const limit = limits[service];
    if (limit && current > limit) {
      logger.warn(`Rate limit exceeded for ${service}: ${current}/${limit}`);
      // Note: We're logging but not throwing - adjust based on your needs
    }
  } catch (error) {
    logger.error(`Usage tracking error: ${error}`);
  }
}

export { router as leadsRouter };
