import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

export interface ComprehensiveAnalysis {
  opportunityScore: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  websiteRecommendations: string[];
  socialMediaRecommendations: string[];
  serviceOptimizations: string[];
  aiAutomationOpportunities: string[];
  estimatedContactName: string;
  draftEmail: string;
  quickWins: string[];
  longTermStrategy: string;
}

export interface SimpleBusinessContext {
  name: string;
  address: string;
  industry: string;
  phone?: string | null;
}

export async function analyzeBusinessComprehensive(context: SimpleBusinessContext): Promise<ComprehensiveAnalysis> {
  const apiKey = config.gemini.apiKey;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const client = new GoogleGenerativeAI(apiKey);

  const prompt = `You are a senior AI & automation consultant helping agencies find and pitch to local SMBs.

BUSINESS TO ANALYZE:
- Business Name: ${context.name}
- Address: ${context.address}
- Industry/Category: ${context.industry}
${context.phone ? `- Phone: ${context.phone}` : ''}

YOUR TASK:
Analyze this business and provide comprehensive, actionable insights for an AI agency to pitch their services. Generate a JSON response with these exact fields:

{
  "opportunityScore": "HIGH" or "MEDIUM" or "LOW",
  "summary": "2-3 sentence overview of the business's digital presence and main opportunities",
  "websiteRecommendations": [
    "Specific recommendation 1 for their website",
    "Specific recommendation 2",
    "Specific recommendation 3"
  ],
  "socialMediaRecommendations": [
    "Specific social media improvement 1",
    "Specific social media improvement 2",
    "Specific social media improvement 3"
  ],
  "serviceOptimizations": [
    "How to improve their core service delivery with AI",
    "Automation opportunity for operations",
    "Customer experience enhancement"
  ],
  "aiAutomationOpportunities": [
    "AI chatbot for 24/7 customer support",
    "Automated appointment booking",
    "AI-powered review response system",
    "Social media content automation"
  ],
  "estimatedContactName": "Best guess at owner/manager name based on business type (e.g., 'Business Owner' or a common name for this industry)",
  "draftEmail": "A complete, professional outreach email (3-4 paragraphs) that:\n- Opens with a specific compliment about their business\n- Identifies 2-3 specific opportunities you noticed\n- Offers a free audit or consultation\n- Has a clear call to action\n- Is personalized with their business name\n- Sounds human, not salesy",
  "quickWins": [
    "Easy win they can implement this week",
    "Another quick improvement",
    "Third fast result"
  ],
  "longTermStrategy": "2-3 sentence description of a 6-month transformation plan"
}

INDUSTRY-SPECIFIC INSIGHTS:
- For restaurants: Focus on online ordering, reservation systems, review management, menu optimization
- For salons/spas: Focus on booking automation, reminder systems, loyalty programs, Instagram presence
- For dentists/doctors: Focus on patient portals, appointment reminders, review generation, HIPAA-compliant chat
- For retailers: Focus on inventory management, e-commerce, local SEO, Google Business optimization
- For service businesses: Focus on quote automation, scheduling, follow-up sequences, referral programs

Be specific to their business type. Use their actual business name in the email.
Return ONLY valid JSON, no markdown, no explanation.`;

  const model = client.getGenerativeModel({
    model: config.gemini.model,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  try {
    const analysis = JSON.parse(response);
    return analysis as ComprehensiveAnalysis;
  } catch {
    throw new Error('Failed to parse AI response');
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const client = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = client.getGenerativeModel({ model: config.gemini.model });
    const result = await model.generateContent('Say "OK" if you are working.');
    const response = result.response.text();
    return response.includes('OK');
  } catch {
    return false;
  }
}
