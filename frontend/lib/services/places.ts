import { Client } from '@googlemaps/google-maps-services-js';
import { config } from '../config';
import { PlaceSearchResult, PlaceDetails } from '../types';

const client = new Client({});

export async function searchPlaces(
  industry: string,
  city: string,
  options: { minRating?: number; maxRating?: number; maxResults?: number } = {}
): Promise<PlaceSearchResult[]> {
  const { minRating = 3.5, maxRating = 4.5, maxResults = 20 } = options;
  const apiKey = config.google.placesApiKey || config.google.mapsApiKey;

  const response = await client.textSearch({
    params: {
      query: `${industry} in ${city}`,
      key: apiKey,
    },
  });

  if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
    throw new Error(`Search failed: ${response.data.status}`);
  }

  let results = response.data.results || [];

  // Filter by rating
  results = results.filter((place) => {
    const rating = place.rating || 0;
    return rating >= minRating && rating <= maxRating;
  });

  // Filter for small local businesses
  results = results.filter((place) => {
    const reviewCount = place.user_ratings_total || 0;
    return reviewCount < 100;
  });

  // Limit results
  results = results.slice(0, maxResults);

  return results.map((place) => ({
    place_id: place.place_id!,
    name: place.name!,
    formatted_address: place.formatted_address!,
    geometry: {
      location: {
        lat: place.geometry!.location.lat,
        lng: place.geometry!.location.lng,
      },
    },
    rating: place.rating,
    user_ratings_total: place.user_ratings_total,
    types: place.types,
    business_status: place.business_status,
  }));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = config.google.placesApiKey || config.google.mapsApiKey;

  const response = await client.placeDetails({
    params: {
      place_id: placeId,
      key: apiKey,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'geometry',
        'rating',
        'user_ratings_total',
        'website',
        'formatted_phone_number',
        'opening_hours',
        'reviews',
        'types',
        'business_status',
      ],
    },
  });

  if (response.data.status !== 'OK') {
    throw new Error(`Place details failed: ${response.data.status}`);
  }

  const place = response.data.result;

  return {
    place_id: place.place_id!,
    name: place.name!,
    formatted_address: place.formatted_address!,
    geometry: {
      location: {
        lat: place.geometry!.location.lat,
        lng: place.geometry!.location.lng,
      },
    },
    rating: place.rating,
    user_ratings_total: place.user_ratings_total,
    types: place.types,
    business_status: place.business_status,
    website: place.website,
    formatted_phone_number: place.formatted_phone_number,
    opening_hours: place.opening_hours,
    reviews: place.reviews?.map((review) => ({
      author_name: review.author_name,
      rating: review.rating,
      text: review.text,
      time: review.time,
      relative_time_description: review.relative_time_description,
    })),
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const apiKey = config.google.placesApiKey || config.google.mapsApiKey;
    const response = await client.geocode({
      params: {
        address: 'San Francisco, CA',
        key: apiKey,
      },
    });
    return response.data.status === 'OK';
  } catch {
    return false;
  }
}
