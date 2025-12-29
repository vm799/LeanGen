import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { BusinessContext, LeadAnalysis, ExternalAPIError } from '../types';
import { logger } from '../utils/logger.util';
import { retry } from '../utils/retry.util';

class GeminiService {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor() {
    this.client = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = config.gemini.model;
  }

  async analyzeBusinessOpportunity(context: BusinessContext): Promise<LeadAnalysis> {
    try {
      logger.info(`Analyzing business: ${context.name}`);

      const prompt = this.buildAnalysisPrompt(context);
      
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const result = await retry(
        () => model.generateContent(prompt),
        { maxRetries: 2, delayMs: 2000 }
      );

      const response = result.response.text();
      const analysis = JSON.parse(response);

      // Validate response structure
      if (
        !analysis.digitalPresenceSummary ||
        !analysis.opportunityScore ||
        !analysis.keyGaps ||
        !analysis.aiAuditPitch
      ) {
        throw new Error('Invalid AI response structure');
      }

      return {
        digitalPresenceSummary: analysis.digitalPresenceSummary,
        opportunityScore: analysis.opportunityScore,
        keyGaps: analysis.keyGaps,
        aiAuditPitch: analysis.aiAuditPitch,
        recommendedTools: analysis.recommendedTools || [],
      };
    } catch (error) {
      logger.error(`Gemini analysis error: ${error}`);
      if (error instanceof SyntaxError) {
        throw new ExternalAPIError('Gemini', 'Failed to parse AI response');
      }
      throw new ExternalAPIError('Gemini', 'Analysis failed');
    }
  }

  private buildAnalysisPrompt(context: BusinessContext): string {
    const websiteStatus = context.websiteHtml
      ? 'Yes'
      : context.hasOnlineBooking !== null
      ? 'Unknown (could not fetch)'
      : 'No';

    return `You are a senior marketing and AI consultant for small local businesses.

BUSINESS CONTEXT:
- Name: ${context.name}
- Industry: ${context.industry}
- Location: ${context.city}
- Google Rating: ${context.rating}/5 (${context.reviewCount} reviews)
- Has Website: ${websiteStatus}
- Has AI Chatbot: ${context.hasChatbot ?? 'Unknown'}
- Has Online Booking: ${context.hasOnlineBooking ?? 'Unknown'}

RECENT REVIEWS (last 3):
${context.recentReviews.slice(0, 3).join('\n\n---\n\n') || 'No reviews available'}

DETECTED UX GAPS:
${context.uxGaps.length > 0 ? context.uxGaps.join('\n') : 'None detected'}

GOOGLE SEARCH INSIGHTS:
${
  context.googleSearchResults.length > 0
    ? context.googleSearchResults.map((r) => `- ${r.title}: ${r.snippet}`).join('\n')
    : 'No additional search insights'
}

TASK:
Analyze this business and generate a JSON response with NO additional text, markdown, or explanation:

{
  "digitalPresenceSummary": "2-4 sentences describing current digital presence strengths and weaknesses",
  "opportunityScore": "HIGH|MEDIUM|LOW",
  "keyGaps": ["specific gap 1", "specific gap 2", "specific gap 3"],
  "aiAuditPitch": "Personalized 3-4 sentence pitch for an AI/marketing audit that references their specific situation, strengths, and opportunities. Use their business name and be specific.",
  "recommendedTools": ["tool 1", "tool 2", "tool 3"]
}

SCORING CRITERIA:
- HIGH: 3+ significant gaps, rating 3.5-4.0, negative/mixed sentiment, no chatbot, manual booking
- MEDIUM: 2 gaps, rating 4.0-4.5, mixed sentiment, missing 1-2 key features
- LOW: 0-1 gaps, rating 4.5+, positive sentiment, strong digital presence

PITCH GUIDELINES:
- Start with their strength (e.g., "Your 4.2-star rating shows customers appreciate...")
- Identify specific opportunity (e.g., "However, without an AI chatbot...")
- Quantify benefit (e.g., "Adding automated booking could save 10+ hours/week")
- End with clear next step (e.g., "I'd love to show you how...")

Return ONLY the JSON object. No markdown formatting, no explanation, no additional text.`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      const result = await model.generateContent('Say "OK" if you are working.');
      const response = result.response.text();
      return response.includes('OK');
    } catch (error) {
      logger.error(`Gemini health check failed: ${error}`);
      return false;
    }
  }
}

export const geminiService = new GeminiService();
