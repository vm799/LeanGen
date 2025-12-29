import { config } from '../config';
import { PlaceSearchResult, PlaceDetails } from '../types';

const TOMTOM_BASE_URL = 'https://api.tomtom.com/search/2';

interface TomTomPOIResult {
  id: string;
  poi: {
    name: string;
    phone?: string;
    url?: string;
    categories?: string[];
    classifications?: Array<{ code: string; names: Array<{ name: string }> }>;
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
  score?: number;
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
    throw new Error('TomTom API key not configured');
  }

  // Use TomTom POI Search
  const query = encodeURIComponent(`${industry} in ${city}`);
  const url = `${TOMTOM_BASE_URL}/poiSearch/${query}.json?key=${apiKey}&limit=${maxResults}&categorySet=7315`; // 7315 = restaurants/businesses

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TomTom search failed: ${response.status}`);
  }

  const data: TomTomSearchResponse = await response.json();

  if (!data.results || data.results.length === 0) {
    return [];
  }

  return data.results.map((result) => ({
    place_id: result.id,
    name: result.poi.name,
    formatted_address: result.address.freeformAddress,
    geometry: {
      location: {
        lat: result.position.lat,
        lng: result.position.lon,
      },
    },
    rating: undefined, // TomTom doesn't provide ratings
    user_ratings_total: undefined,
    types: result.poi.categories || [],
    business_status: 'OPERATIONAL',
    website: result.poi.url,
    phone: result.poi.phone,
  }));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = config.tomtom.apiKey;

  if (!apiKey) {
    throw new Error('TomTom API key not configured');
  }

  // Use TomTom Place by ID
  const url = `${TOMTOM_BASE_URL}/place.json?entityId=${placeId}&key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TomTom place details failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error('Place not found');
  }

  const result = data.results[0] as TomTomPOIResult;

  return {
    place_id: result.id,
    name: result.poi.name,
    formatted_address: result.address.freeformAddress,
    geometry: {
      location: {
        lat: result.position.lat,
        lng: result.position.lon,
      },
    },
    rating: undefined,
    user_ratings_total: undefined,
    types: result.poi.categories || [],
    business_status: 'OPERATIONAL',
    website: result.poi.url,
    formatted_phone_number: result.poi.phone,
    reviews: [], // TomTom doesn't provide reviews
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const apiKey = config.tomtom.apiKey;
    if (!apiKey) return false;

    const url = `${TOMTOM_BASE_URL}/geocode/San%20Francisco.json?key=${apiKey}&limit=1`;
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}
