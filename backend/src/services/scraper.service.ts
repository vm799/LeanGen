import { logger } from '../utils/logger.util';
import { retry } from '../utils/retry.util';

class ScraperService {
  async fetchWebsite(url: string): Promise<string | null> {
    try {
      logger.info(`Fetching website: ${url}`);

      // Ensure URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }

      const response = await retry(
        () =>
          fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (compatible; LeadGenius/1.0; +https://leadgenius.app)',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000), // 10 second timeout
          }),
        { maxRetries: 2, delayMs: 1000 }
      );

      if (!response.ok) {
        logger.warn(`Failed to fetch ${url}: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/html')) {
        logger.warn(`Non-HTML content type for ${url}: ${contentType}`);
        return null;
      }

      const html = await response.text();
      return html;
    } catch (error) {
      logger.error(`Website fetch error for ${url}: ${error}`);
      return null;
    }
  }

  async fetchMultiple(urls: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    // Fetch in parallel with a limit
    const chunks = this.chunkArray(urls, 5); // 5 at a time

    for (const chunk of chunks) {
      const promises = chunk.map(async (url) => {
        const html = await this.fetchWebsite(url);
        results.set(url, html);
      });

      await Promise.all(promises);
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const scraperService = new ScraperService();
