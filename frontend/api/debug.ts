import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchPlaces } from '../lib/services/places';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const tomtomKey = process.env.TOMTOM_API_KEY || process.env.VITE_TOMTOM_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Test TomTom API directly
  let tomtomStatus = 'not configured';
  if (tomtomKey) {
    try {
      const url = `https://api.tomtom.com/search/2/search/test.json?key=${tomtomKey}&limit=1`;
      const response = await fetch(url);
      tomtomStatus = response.ok ? 'working' : `error: ${response.status}`;
    } catch (error) {
      tomtomStatus = `fetch failed: ${error instanceof Error ? error.message : 'unknown'}`;
    }
  }

  // Test the actual searchPlaces function
  let searchTest = 'not tested';
  try {
    const results = await searchPlaces('restaurant', 'Austin TX', { maxResults: 3 });
    searchTest = `success: found ${results.length} results`;
  } catch (error) {
    searchTest = `error: ${error instanceof Error ? error.message : 'unknown error'}`;
  }

  return res.status(200).json({
    env: {
      TOMTOM_API_KEY: tomtomKey ? `${tomtomKey.substring(0, 8)}...` : 'NOT SET',
      GEMINI_API_KEY: geminiKey ? `${geminiKey.substring(0, 8)}...` : 'NOT SET',
    },
    tomtomStatus,
    searchTest,
    nodeVersion: process.version,
  });
}
