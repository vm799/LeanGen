import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { searchPlaces } from '../lib/services/places';

const searchParamsSchema = z.object({
  industry: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
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

  try {
    // Log incoming request
    console.log('Request body:', JSON.stringify(req.body));

    const validationResult = searchParamsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: validationResult.error.flatten(),
      });
    }

    const { industry, city } = validationResult.data;
    console.log('Searching for:', industry, 'in', city);

    const places = await searchPlaces(industry, city, { maxResults: 20 });
    console.log('Found places:', places.length);

    const leads = places.map((place) => ({
      id: place.place_id,
      name: place.name,
      category: place.types?.[0] || null,
      address: place.formatted_address,
      rating: place.rating || null,
      reviewCount: place.user_ratings_total || null,
      location: place.geometry.location,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.formatted_address)}`,
      websiteUrl: null,
      phone: null,
      analyzed: false,
    }));

    return res.status(200).json({
      leads,
      total: leads.length,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
