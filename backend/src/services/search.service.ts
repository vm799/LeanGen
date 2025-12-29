import { config } from '../config';
import { SearchResult, ExternalAPIError } from '../types';
import { logger } from '../utils/logger.util';
import { retry } from '../utils/retry.util';

class SearchService {
  private apiKey: string;
  private searchEngineId: string;
  private baseUrl = 'https://www.googleapis.com/customsearch/v1';

  constructor() {
    this.apiKey = config.google.searchApiKey;
    this.searchEngineId = config.google.searchCx;
  }

  async search(query: string, numResults: number = 5): Promise<SearchResult[]> {
    if (!this.apiKey || !this.searchEngineId) {
      logger.warn('Google Search API not configured, skipping search');
      return [];
    }

    try {
      logger.info(`Searching Google for: ${query}`);

      const url = new URL(this.baseUrl);
      url.searchParams.append('key', this.apiKey);
      url.searchParams.append('cx', this.searchEngineId);
      url.searchParams.append('q', query);
      url.searchParams.append('num', Math.min(numResults, 10).toString());

      const response = await retry(
        () =>
          fetch(url.toString(), {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          }),
        { maxRetries: 2 }
      );

      if (!response.ok) {
        throw new ExternalAPIError(
          'Google Search',
          `Search failed: ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        logger.info(`No search results for: ${query}`);
        return [];
      }

      return data.items.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        displayLink: item.displayLink,
      }));
    } catch (error) {
      logger.error(`Google Search error: ${error}`);
      // Don't throw - search is supplementary
      return [];
    }
  }

  async searchBusinessReviews(
    businessName: string,
    city: string
  ): Promise<SearchResult[]> {
    const query = `${businessName} ${city} reviews`;
    return this.search(query, 3);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey || !this.searchEngineId) {
      return false;
    }

    try {
      const results = await this.search('test', 1);
      return true;
    } catch (error) {
      logger.error(`Search health check failed: ${error}`);
      return false;
    }
  }
}

export const searchService = new SearchService();
