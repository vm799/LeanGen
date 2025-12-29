import * as cheerio from 'cheerio';
import { ChatbotDetection } from '../types';
import { logger } from '../utils/logger.util';

class ChatbotAnalyzer {
  private readonly CHATBOT_SIGNATURES = [
    // Popular chat widgets
    { pattern: /intercom/i, provider: 'Intercom' },
    { pattern: /drift\.com/i, provider: 'Drift' },
    { pattern: /tawk\.to/i, provider: 'Tawk.to' },
    { pattern: /zendesk.*chat/i, provider: 'Zendesk Chat' },
    { pattern: /crisp\.chat/i, provider: 'Crisp' },
    { pattern: /livechatinc\.com/i, provider: 'LiveChat' },
    { pattern: /tidio\.com/i, provider: 'Tidio' },
    { pattern: /olark/i, provider: 'Olark' },
    { pattern: /freshchat/i, provider: 'Freshchat' },
    { pattern: /hubspot.*conversations/i, provider: 'HubSpot Chat' },
    
    // Generic patterns
    { pattern: /chat.*widget/i, provider: 'Generic Chat Widget' },
    { pattern: /live.*chat/i, provider: 'Generic Live Chat' },
    { pattern: /webchat/i, provider: 'Generic Web Chat' },
  ];

  async analyze(html: string | null): Promise<ChatbotDetection> {
    if (!html) {
      return {
        hasChatbot: false,
        confidence: 1.0,
        detectedProvider: null,
        evidence: ['No website HTML available'],
      };
    }

    try {
      const $ = cheerio.load(html);
      const evidence: string[] = [];
      let detectedProvider: string | null = null;

      // Check script tags
      $('script').each((_, el) => {
        const src = $(el).attr('src') || '';
        const content = $(el).html() || '';

        for (const sig of this.CHATBOT_SIGNATURES) {
          if (sig.pattern.test(src) || sig.pattern.test(content)) {
            evidence.push(`Found ${sig.provider} in script tag`);
            if (!detectedProvider) {
              detectedProvider = sig.provider;
            }
          }
        }
      });

      // Check for chat-like DOM elements
      const chatSelectors = [
        '#chat-widget',
        '.chat-widget',
        '[data-chat]',
        '.livechat',
        '#livechat',
        '.chat-button',
        '#chat-button',
        '[class*="chat"]',
        '[id*="chat"]',
      ];

      chatSelectors.forEach((selector) => {
        const elements = $(selector);
        if (elements.length > 0) {
          evidence.push(`Found chat element: ${selector} (${elements.length} instances)`);
        }
      });

      // Check for iframe chat widgets
      $('iframe').each((_, el) => {
        const src = $(el).attr('src') || '';
        for (const sig of this.CHATBOT_SIGNATURES) {
          if (sig.pattern.test(src)) {
            evidence.push(`Found ${sig.provider} in iframe`);
            if (!detectedProvider) {
              detectedProvider = sig.provider;
            }
          }
        }
      });

      const hasChatbot = evidence.length > 0;
      const confidence = Math.min(evidence.length * 0.4, 1.0);

      return {
        hasChatbot,
        confidence,
        detectedProvider,
        evidence,
      };
    } catch (error) {
      logger.error(`Chatbot analysis error: ${error}`);
      return {
        hasChatbot: false,
        confidence: 0,
        detectedProvider: null,
        evidence: ['Analysis failed'],
      };
    }
  }
}

export const chatbotAnalyzer = new ChatbotAnalyzer();
