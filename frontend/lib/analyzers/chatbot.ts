import * as cheerio from 'cheerio';
import { ChatbotDetection } from '../types';

const CHATBOT_SIGNATURES = [
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
  { pattern: /chat.*widget/i, provider: 'Generic Chat Widget' },
  { pattern: /live.*chat/i, provider: 'Generic Live Chat' },
  { pattern: /webchat/i, provider: 'Generic Web Chat' },
];

export function analyzeChatbot(html: string | null): ChatbotDetection {
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

      for (const sig of CHATBOT_SIGNATURES) {
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
    ];

    chatSelectors.forEach((selector) => {
      const elements = $(selector);
      if (elements.length > 0) {
        evidence.push(`Found chat element: ${selector}`);
      }
    });

    // Check iframes
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || '';
      for (const sig of CHATBOT_SIGNATURES) {
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

    return { hasChatbot, confidence, detectedProvider, evidence };
  } catch {
    return {
      hasChatbot: false,
      confidence: 0,
      detectedProvider: null,
      evidence: ['Analysis failed'],
    };
  }
}
