import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPlaceDetails } from '../../../lib/services/places';
import { analyzeBusinessOpportunity } from '../../../lib/services/gemini';
import { fetchWebsite } from '../../../lib/services/scraper';
import { analyzeChatbot } from '../../../lib/analyzers/chatbot';
import { analyzeBooking } from '../../../lib/analyzers/booking';
import { analyzeSentiment } from '../../../lib/analyzers/sentiment';
import { analyzeSEO } from '../../../lib/analyzers/seo';
import { AnalysisResponse } from '../../../lib/types';

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
    const { id: placeId } = req.query;

    if (!placeId || typeof placeId !== 'string') {
      return res.status(400).json({ error: 'Place ID is required' });
    }

    // Get place details
    const place = await getPlaceDetails(placeId);

    // Fetch website HTML if available
    let websiteHtml: string | null = null;
    if (place.website) {
      websiteHtml = await fetchWebsite(place.website);
    }

    // Run analyzers in parallel
    const [chatbot, booking, sentiment, seo] = await Promise.all([
      Promise.resolve(analyzeChatbot(websiteHtml)),
      Promise.resolve(analyzeBooking(websiteHtml)),
      Promise.resolve(analyzeSentiment(place.reviews)),
      Promise.resolve(analyzeSEO(websiteHtml)),
    ]);

    // Build UX gaps list
    const uxGaps: string[] = [];
    if (!chatbot.hasChatbot) uxGaps.push('No AI chatbot for customer support');
    if (!booking.hasBooking) uxGaps.push('No online booking system');
    if (seo.gaps.length > 0) uxGaps.push(...seo.gaps.slice(0, 2));

    // Call Gemini for AI analysis
    const aiAnalysis = await analyzeBusinessOpportunity({
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
      googleSearchResults: [],
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

    return res.status(200).json({ ...response, cached: false });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ error: 'Analysis failed' });
  }
}
