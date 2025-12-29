import { config } from '../config';
import { PlaceSearchResult, PlaceDetails } from '../types';

const TOMTOM_BASE_URL = 'https://api.tomtom.com/search/2';

interface TomTomPOIResult {
  id: string;
  poi?: {
    name: string;
    phone?: string;
    url?: string;
    categories?: string[];
  };
  address: {
    freeformAddress: string;
    municipality?: string;
    countrySubdivision?: string;
  };
  position: {
    lat: number;
    lon: number;
  };
  type?: string;
}

interface TomTomSearchResponse {
  results: TomTomPOIResult[];
  summary: {
    totalResults: number;
  };
}

export async function searchPlaces(
  industry: string,
  city: string,
  options: { minRating?: number; maxRating?: number; maxResults?: number } = {}
): Promise<PlaceSearchResult[]> {
  const { maxResults = 20 } = options;
  const apiKey = config.tomtom.apiKey;

  if (!apiKey) {
    throw new Error('TOMTOM_API_KEY not configured in Vercel');
  }

  // TomTom Fuzzy Search API - search for businesses
  // URL format: https://api.tomtom.com/search/2/search/{query}.json
  const searchQuery = `${industry} ${city}`;
  const encodedQuery = encodeURIComponent(searchQuery);

  const url = `${TOMTOM_BASE_URL}/search/${encodedQuery}.json?key=${apiKey}&limit=${maxResults}&typeahead=false&language=en-US&idxSet=POI`;

  console.log('Searching TomTom:', searchQuery);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TomTom API error:', response.status, errorText);
      throw new Error(`TomTom API error: ${response.status}`);
    }

    const data: TomTomSearchResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      console.log('No results found');
      return [];
    }

    console.log('Found', data.results.length, 'results');

    // Map results to our format - include ALL results, not just those with poi.name
    return data.results.map((result) => ({
      place_id: result.id,
      name: result.poi?.name || result.address.freeformAddress.split(',')[0],
      formatted_address: result.address.freeformAddress,
      geometry: {
        location: {
          lat: result.position.lat,
          lng: result.position.lon,
        },
      },
      rating: undefined,
      user_ratings_total: undefined,
      types: result.poi?.categories || [],
      business_status: 'OPERATIONAL',
      website: result.poi?.url,
      phone: result.poi?.phone,
    }));
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = config.tomtom.apiKey;

  if (!apiKey) {
    throw new Error('TOMTOM_API_KEY not configured');
  }

  const url = `${TOMTOM_BASE_URL}/place.json?entityId=${placeId}&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Place details failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error('Place not found');
  }

  const result = data.results[0] as TomTomPOIResult;

  return {
    place_id: result.id,
    name: result.poi?.name || result.address.freeformAddress,
    formatted_address: result.address.freeformAddress,
    geometry: {
      location: {
        lat: result.position.lat,
        lng: result.position.lon,
      },
    },
    rating: undefined,
    user_ratings_total: undefined,
    types: result.poi?.categories || [],
    business_status: 'OPERATIONAL',
    website: result.poi?.url,
    formatted_phone_number: result.poi?.phone,
    reviews: [],
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const apiKey = config.tomtom.apiKey;
    if (!apiKey) return false;

    const url = `${TOMTOM_BASE_URL}/search/test.json?key=${apiKey}&limit=1`;
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}
