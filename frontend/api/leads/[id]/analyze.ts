import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeBusinessComprehensive } from '../../../lib/services/gemini';

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
    // Get business info from request body
    const { name, address, industry, phone } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'Business name and address are required' });
    }

    console.log('Analyzing business:', name);

    // Call Gemini for comprehensive AI analysis
    const analysis = await analyzeBusinessComprehensive({
      name,
      address,
      industry: industry || 'Local Business',
      phone,
    });

    console.log('Analysis complete for:', name);

    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
}
