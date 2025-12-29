import * as cheerio from 'cheerio';
import { SEOAnalysis } from '../types';
import { logger } from '../utils/logger.util';

class SEOAnalyzer {
  async analyze(html: string | null): Promise<SEOAnalysis> {
    if (!html) {
      return {
        hasMetaDescription: false,
        hasTitle: false,
        hasH1: false,
        hasStructuredData: false,
        hasMobileViewport: false,
        gaps: ['No website available for analysis'],
      };
    }

    try {
      const $ = cheerio.load(html);
      const gaps: string[] = [];

      // Check for title tag
      const hasTitle = $('title').length > 0 && $('title').text().trim().length > 0;
      if (!hasTitle) gaps.push('Missing or empty <title> tag');

      // Check for meta description
      const hasMetaDescription =
        $('meta[name="description"]').length > 0 &&
        $('meta[name="description"]').attr('content')?.trim().length! > 0;
      if (!hasMetaDescription) gaps.push('Missing meta description');

      // Check for H1 tag
      const hasH1 = $('h1').length > 0;
      if (!hasH1) gaps.push('Missing H1 heading');

      // Check for mobile viewport
      const hasMobileViewport = $('meta[name="viewport"]').length > 0;
      if (!hasMobileViewport) gaps.push('Missing mobile viewport meta tag');

      // Check for structured data (JSON-LD)
      const hasStructuredData =
        $('script[type="application/ld+json"]').length > 0;
      if (!hasStructuredData) gaps.push('Missing structured data (Schema.org)');

      // Additional checks
      const imgWithoutAlt = $('img:not([alt])').length;
      if (imgWithoutAlt > 0) {
        gaps.push(`${imgWithoutAlt} images missing alt text`);
      }

      const hasCanonical = $('link[rel="canonical"]').length > 0;
      if (!hasCanonical) gaps.push('Missing canonical URL');

      const hasOgTags = $('meta[property^="og:"]').length > 0;
      if (!hasOgTags) gaps.push('Missing Open Graph tags for social sharing');

      return {
        hasMetaDescription,
        hasTitle,
        hasH1,
        hasStructuredData,
        hasMobileViewport,
        gaps,
      };
    } catch (error) {
      logger.error(`SEO analysis error: ${error}`);
      return {
        hasMetaDescription: false,
        hasTitle: false,
        hasH1: false,
        hasStructuredData: false,
        hasMobileViewport: false,
        gaps: ['SEO analysis failed'],
      };
    }
  }
}

export const seoAnalyzer = new SEOAnalyzer();
