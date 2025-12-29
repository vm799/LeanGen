// Note: In Vercel serverless functions, VITE_ prefix vars are NOT available
// Use TOMTOM_API_KEY for backend, VITE_TOMTOM_API_KEY is for frontend only
export const config = {
  tomtom: {
    apiKey: process.env.TOMTOM_API_KEY || process.env.VITE_TOMTOM_API_KEY || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
  },
};
