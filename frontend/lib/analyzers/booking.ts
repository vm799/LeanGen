import * as cheerio from 'cheerio';
import { BookingDetection } from '../types';

const BOOKING_SIGNATURES = [
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
  { pattern: /book.*appointment/i, provider: 'Generic Booking System' },
  { pattern: /schedule.*online/i, provider: 'Generic Scheduling' },
  { pattern: /online.*booking/i, provider: 'Generic Online Booking' },
];

export function analyzeBooking(html: string | null): BookingDetection {
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

      for (const sig of BOOKING_SIGNATURES) {
        if (sig.pattern.test(src) || sig.pattern.test(content)) {
          evidence.push(`Found ${sig.provider} in script`);
          if (!detectedSystem) {
            detectedSystem = sig.provider;
          }
        }
      }
    });

    // Check for booking-related links
    $('a[href*="book"], a[href*="appointment"], a[href*="schedule"]').each(() => {
      evidence.push('Found booking-related link');
    });

    // Check iframes
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || '';
      for (const sig of BOOKING_SIGNATURES) {
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

    return { hasBooking, confidence, detectedSystem, evidence };
  } catch {
    return {
      hasBooking: false,
      confidence: 0,
      detectedSystem: null,
      evidence: ['Analysis failed'],
    };
  }
}
