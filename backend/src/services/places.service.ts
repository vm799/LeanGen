import { Client } from '@googlemaps/google-maps-services-js';
import { config } from '../config';
import { PlaceSearchResult, PlaceDetails, ExternalAPIError } from '../types';
import { logger } from '../utils/logger.util';
import { retry } from '../utils/retry.util';

class PlacesService {
  private client: Client;
  private apiKey: string;

  constructor() {
    this.client = new Client({});
    this.apiKey = config.google.placesApiKey || config.google.mapsApiKey;
  }

  async searchPlaces(
    industry: string,
    city: string,
    options: {
      minRating?: number;
      maxRating?: number;
      maxResults?: number;
    } = {}
  ): Promise<PlaceSearchResult[]> {
    const { minRating = 3.5, maxRating = 4.5, maxResults = 20 } = options;

    try {
      logger.info(`Searching for ${industry} in ${city}`);

      const response = await retry(
        () =>
          this.client.textSearch({
            params: {
              query: `${industry} in ${city}`,
              key: this.apiKey,
            },
          }),
        { maxRetries: 3 }
      );

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new ExternalAPIError(
          'Google Places',
          `Search failed: ${response.data.status}`
        );
      }

      let results = response.data.results || [];

      // Filter by rating
      results = results.filter((place) => {
        const rating = place.rating || 0;
        return rating >= minRating && rating <= maxRating;
      });

      // Filter for small local businesses (heuristic: fewer reviews indicates smaller)
      results = results.filter((place) => {
        const reviewCount = place.user_ratings_total || 0;
        return reviewCount < 100; // Adjust threshold as needed
      });

      // Limit results
      results = results.slice(0, maxResults);

      logger.info(`Found ${results.length} places matching criteria`);

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
    } catch (error) {
      logger.error(`Places search error: ${error}`);
      if (error instanceof ExternalAPIError) {
        throw error;
      }
      throw new ExternalAPIError('Google Places', 'Search failed');
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    try {
      logger.info(`Fetching details for place: ${placeId}`);

      const response = await retry(
        () =>
          this.client.placeDetails({
            params: {
              place_id: placeId,
              key: this.apiKey,
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
                'photos',
                'types',
                'business_status',
              ],
            },
          }),
        { maxRetries: 3 }
      );

      if (response.data.status !== 'OK') {
        throw new ExternalAPIError(
          'Google Places',
          `Place details failed: ${response.data.status}`
        );
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
        photos: place.photos,
      };
    } catch (error) {
      logger.error(`Place details error: ${error}`);
      if (error instanceof ExternalAPIError) {
        throw error;
      }
      throw new ExternalAPIError('Google Places', 'Place details failed');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check: try to geocode a known location
      const response = await this.client.geocode({
        params: {
          address: 'San Francisco, CA',
          key: this.apiKey,
        },
      });

      return response.data.status === 'OK';
    } catch (error) {
      logger.error(`Places health check failed: ${error}`);
      return false;
    }
  }
}

export const placesService = new PlacesService();
