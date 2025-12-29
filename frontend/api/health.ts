import type { VercelRequest, VercelResponse } from '@vercel/node';
import { healthCheck as placesHealthCheck } from '../lib/services/places';
import { healthCheck as geminiHealthCheck } from '../lib/services/gemini';
import { HealthCheck } from '../lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check TomTom API
  try {
    const start = Date.now();
    const isHealthy = await placesHealthCheck();
    const responseTime = Date.now() - start;

    health.services.tomtom = {
      status: isHealthy ? 'up' : 'down',
      responseTime,
      ...(isHealthy ? {} : { error: 'TomTom API not responding' }),
    };

    if (!isHealthy) health.status = 'degraded';
  } catch {
    health.services.tomtom = { status: 'down', error: 'TomTom API check failed' };
    health.status = 'degraded';
  }

  // Check Gemini API
  try {
    const start = Date.now();
    const isHealthy = await geminiHealthCheck();
    const responseTime = Date.now() - start;

    health.services.gemini = {
      status: isHealthy ? 'up' : 'down',
      responseTime,
      ...(isHealthy ? {} : { error: 'Gemini API unavailable' }),
    };

    if (!isHealthy) health.status = 'degraded';
  } catch {
    health.services.gemini = { status: 'down', error: 'Gemini API check failed' };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return res.status(statusCode).json(health);
}
