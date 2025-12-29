// Lead Types
export interface Lead {
  id: string;
  name: string;
  category: string | null;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  location: {
    lat: number;
    lng: number;
  };
  mapsUrl: string;
  websiteUrl: string | null;
  phone: string | null;
  analyzed: boolean;
  analysis?: LeadAnalysis;
  technicalDetails?: TechnicalDetails;
}

export interface LeadAnalysis {
  digitalPresenceSummary: string;
  opportunityScore: 'HIGH' | 'MEDIUM' | 'LOW';
  keyGaps: string[];
  aiAuditPitch: string;
  recommendedTools: string[];
}

export interface TechnicalDetails {
  chatbot: ChatbotDetection;
  booking: BookingDetection;
  sentiment: SentimentAnalysis;
  seo?: SEOAnalysis;
}

// Search Types
export interface SearchParams {
  industry: string;
  city: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  minRating?: number;
  maxRating?: number;
  maxReviews?: number;
  requireMissingChatbot?: boolean;
  requireManualBooking?: boolean;
  sentimentThreshold?: 'POSITIVE' | 'MIXED' | 'NEGATIVE' | 'ANY';
  radiusMiles?: number;
}

// Google Places Types
export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
}

export interface PlaceDetails extends PlaceSearchResult {
  website?: string;
  formatted_phone_number?: string;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
  };
  reviews?: PlaceReview[];
  photos?: PlacePhoto[];
}

export interface PlaceReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

export interface PlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
}

// Analyzer Types
export interface ChatbotDetection {
  hasChatbot: boolean;
  confidence: number;
  detectedProvider: string | null;
  evidence: string[];
}

export interface BookingDetection {
  hasBooking: boolean;
  confidence: number;
  detectedSystem: string | null;
  evidence: string[];
}

export interface SentimentAnalysis {
  overall: 'POSITIVE' | 'MIXED' | 'NEGATIVE';
  score: number; // -1 to 1
  distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  recentTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  keyPhrases: {
    positive: string[];
    negative: string[];
  };
}

export interface SEOAnalysis {
  hasMetaDescription: boolean;
  hasTitle: boolean;
  hasH1: boolean;
  hasStructuredData: boolean;
  hasMobileViewport: boolean;
  gaps: string[];
}

// Google Search Types
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

// Business Context for AI
export interface BusinessContext {
  name: string;
  industry: string;
  city: string;
  rating: number;
  reviewCount: number;
  recentReviews: string[];
  websiteHtml: string | null;
  hasChatbot: boolean | null;
  hasOnlineBooking: boolean | null;
  uxGaps: string[];
  googleSearchResults: SearchResult[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  timestamp?: string;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  cached: boolean;
}

export interface AnalysisResponse {
  placeId: string;
  analysis: LeadAnalysis;
  technicalDetails: TechnicalDetails;
}

// Health Check Types
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  services: {
    maps?: ServiceStatus;
    gemini?: ServiceStatus;
    database?: ServiceStatus;
    cache?: ServiceStatus;
    search?: ServiceStatus;
  };
  usage?: {
    placesSearchToday: number;
    placeDetailsToday: number;
    geminiCallsToday: number;
    searchQueriesToday: number;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down';
  error?: string;
  responseTime?: number;
}

// Error Types
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true);
  }
}

export class ExternalAPIError extends AppError {
  constructor(
    public service: string,
    message: string = 'External API error'
  ) {
    super(message, 502, true);
  }
}
