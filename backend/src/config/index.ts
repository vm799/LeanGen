import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  
  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // Google APIs
  google: {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    placesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
    searchApiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
    searchCx: process.env.GOOGLE_SEARCH_CX || '',
  },
  
  // AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
  },
  
  // Rate Limits (per day)
  rateLimits: {
    placesSearch: parseInt(process.env.DAILY_PLACES_SEARCH_LIMIT || '500', 10),
    placeDetails: parseInt(process.env.DAILY_PLACES_DETAILS_LIMIT || '1000', 10),
    gemini: parseInt(process.env.DAILY_GEMINI_LIMIT || '2000', 10),
    search: parseInt(process.env.DAILY_SEARCH_LIMIT || '200', 10),
  },
  
  // Cache TTLs (in seconds)
  cache: {
    leadSearch: 3600, // 1 hour
    leadAnalysis: 86400, // 24 hours
    placeDetails: 3600, // 1 hour
    searchResults: 7200, // 2 hours
  },
  
  // CORS
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  },
  
  // Monitoring
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
};

// Validation
export function validateConfig(): void {
  const required = [
    'GOOGLE_MAPS_API_KEY',
    'GOOGLE_PLACES_API_KEY',
    'GEMINI_API_KEY',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Only validate in production
if (config.nodeEnv === 'production') {
  validateConfig();
}
