export const config = {
  google: {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    placesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
    searchApiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
    searchCx: process.env.GOOGLE_SEARCH_CX || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
  },
};
