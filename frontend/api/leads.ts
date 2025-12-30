import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { searchPlaces } from '../lib/services/places';
import { Lead } from '../lib/types';

const searchParamsSchema = z.object({
  industry: z.string().min(2).max(100),
  city: z.string().min(2).max(100),
  filters: z
    .object({
      minRating: z.number().min(1).max(5).optional(),
      maxRating: z.number().min(1).max(5).optional(),
    })
    .optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key first
  const hasApiKey = !!(process.env.TOMTOM_API_KEY || process.env.VITE_TOMTOM_API_KEY);
  if (!hasApiKey) {
    return res.status(500).json({
      error: 'TOMTOM_API_KEY not configured',
      hint: 'Add TOMTOM_API_KEY to Vercel Environment Variables (Project Settings → Environment Variables)',
    });
  }

  try {
    const validationResult = searchParamsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: `Invalid search parameters: ${validationResult.error.message}`,
      });
    }

    const { industry, city, filters } = validationResult.data;

    const places = await searchPlaces(industry, city, {
      minRating: filters?.minRating,
      maxRating: filters?.maxRating,
      maxResults: 20,
    });

    const leads: Lead[] = places.map((place) => ({
      id: place.place_id,
      name: place.name,
      category: place.types?.[0] || null,
      address: place.formatted_address,
      rating: place.rating || null,
      reviewCount: place.user_ratings_total || null,
      location: place.geometry.location,
      mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      websiteUrl: null,
      phone: null,
      analyzed: false,
    }));

    return res.status(200).json({
      leads,
      total: leads.length,
      cached: false,
    });
  } catch (error) {
    console.error('Search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Search failed';
    return res.status(500).json({
      error: errorMessage,
      hint: 'Check that TOMTOM_API_KEY is set in Vercel environment variables',
    });
  }
}
