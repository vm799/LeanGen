import * as cheerio from 'cheerio';
import { BookingDetection } from '../types';
import { logger } from '../utils/logger.util';

class BookingAnalyzer {
  private readonly BOOKING_SIGNATURES = [
    // Popular booking systems
    { pattern: /calendly/i, provider: 'Calendly' },
    { pattern: /acuityscheduling/i, provider: 'Acuity Scheduling' },
    { pattern: /square.*appointments/i, provider: 'Square Appointments' },
    { pattern: /setmore/i, provider: 'Setmore' },
    { pattern: /appointlet/i, provider: 'Appointlet' },
    { pattern: /booksy/i, provider: 'Booksy' },
    { pattern: /mindbodyonline/i, provider: 'MINDBODY' },
    { pattern: /opentable/i, provider: 'OpenTable' },
    { pattern: /resy/i, provider: 'Resy' },
    { pattern: /yelp.*reservations/i, provider: 'Yelp Reservations' },
    { pattern: /booking\.com/i, provider: 'Booking.com' },
    
    // Generic patterns
    { pattern: /book.*appointment/i, provider: 'Generic Booking System' },
    { pattern: /schedule.*online/i, provider: 'Generic Scheduling' },
    { pattern: /online.*booking/i, provider: 'Generic Online Booking' },
    { pattern: /reserve.*online/i, provider: 'Generic Reservation' },
  ];

  async analyze(html: string | null): Promise<BookingDetection> {
    if (!html) {
      return {
        hasBooking: false,
        confidence: 1.0,
        detectedSystem: null,
        evidence: ['No website HTML available'],
      };
    }

    try {
      const $ = cheerio.load(html);
      const evidence: string[] = [];
      let detectedSystem: string | null = null;

      // Check script tags
      $('script').each((_, el) => {
        const src = $(el).attr('src') || '';
        const content = $(el).html() || '';

        for (const sig of this.BOOKING_SIGNATURES) {
          if (sig.pattern.test(src) || sig.pattern.test(content)) {
            evidence.push(`Found ${sig.provider} in script`);
            if (!detectedSystem) {
              detectedSystem = sig.provider;
            }
          }
        }
      });

      // Check for booking-related buttons and links
      const bookingSelectors = [
        'a[href*="book"]',
        'a[href*="appointment"]',
        'a[href*="schedule"]',
        'button:contains("Book")',
        'button:contains("Schedule")',
        'button:contains("Reserve")',
        '.book-button',
        '.booking-button',
        '#book-now',
        '.schedule-appointment',
      ];

      bookingSelectors.forEach((selector) => {
        try {
          const elements = $(selector);
          if (elements.length > 0) {
            evidence.push(`Found booking element: ${selector} (${elements.length} instances)`);
          }
        } catch (err) {
          // Some selectors might not be valid in cheerio
        }
      });

      // Check for booking-related forms
      $('form').each((_, el) => {
        const formHtml = $(el).html() || '';
        if (
          /book|appointment|schedule|reservation/i.test(formHtml) &&
          formHtml.includes('input')
        ) {
          evidence.push('Found booking-related form');
        }
      });

      // Check iframes for embedded booking systems
      $('iframe').each((_, el) => {
        const src = $(el).attr('src') || '';
        for (const sig of this.BOOKING_SIGNATURES) {
          if (sig.pattern.test(src)) {
            evidence.push(`Found ${sig.provider} in iframe`);
            if (!detectedSystem) {
              detectedSystem = sig.provider;
            }
          }
        }
      });

      const hasBooking = evidence.length > 0;
      const confidence = Math.min(evidence.length * 0.35, 1.0);

      return {
        hasBooking,
        confidence,
        detectedSystem,
        evidence,
      };
    } catch (error) {
      logger.error(`Booking analysis error: ${error}`);
      return {
        hasBooking: false,
        confidence: 0,
        detectedSystem: null,
        evidence: ['Analysis failed'],
      };
    }
  }
}

export const bookingAnalyzer = new BookingAnalyzer();
