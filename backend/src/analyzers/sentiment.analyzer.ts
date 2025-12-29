import { SentimentAnalysis, PlaceReview } from '../types';
import { logger } from '../utils/logger.util';

class SentimentAnalyzer {
  private readonly POSITIVE_WORDS = [
    'great',
    'excellent',
    'amazing',
    'wonderful',
    'fantastic',
    'love',
    'best',
    'perfect',
    'awesome',
    'outstanding',
    'highly recommend',
    'professional',
    'friendly',
    'clean',
    'helpful',
  ];

  private readonly NEGATIVE_WORDS = [
    'bad',
    'terrible',
    'awful',
    'horrible',
    'worst',
    'disappointing',
    'rude',
    'unprofessional',
    'dirty',
    'slow',
    'overpriced',
    'never again',
    'waste',
    'poor',
    'unacceptable',
  ];

  async analyze(reviews: PlaceReview[] | undefined): Promise<SentimentAnalysis> {
    if (!reviews || reviews.length === 0) {
      return {
        overall: 'MIXED',
        score: 0,
        distribution: {
          positive: 0,
          neutral: 0,
          negative: 0,
        },
        recentTrend: 'STABLE',
        keyPhrases: {
          positive: [],
          negative: [],
        },
      };
    }

    try {
      // Analyze each review
      const reviewScores = reviews.map((review) => {
        const score = this.analyzeReviewText(review.text);
        return {
          rating: review.rating,
          textScore: score,
          time: review.time,
        };
      });

      // Calculate distribution
      const positive = reviewScores.filter((r) => r.rating >= 4).length;
      const negative = reviewScores.filter((r) => r.rating <= 2).length;
      const neutral = reviewScores.length - positive - negative;

      // Calculate overall sentiment
      const avgRating =
        reviewScores.reduce((sum, r) => sum + r.rating, 0) / reviewScores.length;
      let overall: 'POSITIVE' | 'MIXED' | 'NEGATIVE';
      if (avgRating >= 4.0) overall = 'POSITIVE';
      else if (avgRating >= 3.0) overall = 'MIXED';
      else overall = 'NEGATIVE';

      // Calculate sentiment score (-1 to 1)
      const score = (avgRating - 3) / 2; // Normalize 1-5 rating to -1 to 1

      // Determine recent trend (last 5 reviews vs previous)
      const recentTrend = this.calculateTrend(reviewScores);

      // Extract key phrases
      const keyPhrases = this.extractKeyPhrases(reviews);

      return {
        overall,
        score,
        distribution: {
          positive,
          neutral,
          negative,
        },
        recentTrend,
        keyPhrases,
      };
    } catch (error) {
      logger.error(`Sentiment analysis error: ${error}`);
      return {
        overall: 'MIXED',
        score: 0,
        distribution: {
          positive: 0,
          neutral: 0,
          negative: 0,
        },
        recentTrend: 'STABLE',
        keyPhrases: {
          positive: [],
          negative: [],
        },
      };
    }
  }

  private analyzeReviewText(text: string): number {
    const lowerText = text.toLowerCase();
    let score = 0;

    // Count positive words
    for (const word of this.POSITIVE_WORDS) {
      if (lowerText.includes(word)) {
        score += 0.2;
      }
    }

    // Count negative words
    for (const word of this.NEGATIVE_WORDS) {
      if (lowerText.includes(word)) {
        score -= 0.2;
      }
    }

    // Clamp to -1 to 1
    return Math.max(-1, Math.min(1, score));
  }

  private calculateTrend(
    reviewScores: Array<{ rating: number; time: number }>
  ): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    if (reviewScores.length < 6) {
      return 'STABLE';
    }

    // Sort by time (most recent first)
    const sorted = [...reviewScores].sort((a, b) => b.time - a.time);

    // Compare recent 5 vs previous 5
    const recentAvg = sorted.slice(0, 5).reduce((sum, r) => sum + r.rating, 0) / 5;
    const previousAvg = sorted.slice(5, 10).reduce((sum, r) => sum + r.rating, 0) / 5;

    const diff = recentAvg - previousAvg;

    if (diff > 0.3) return 'IMPROVING';
    if (diff < -0.3) return 'DECLINING';
    return 'STABLE';
  }

  private extractKeyPhrases(reviews: PlaceReview[]): {
    positive: string[];
    negative: string[];
  } {
    const positive: string[] = [];
    const negative: string[] = [];

    // Simple extraction: find sentences with strongly positive/negative words
    reviews.forEach((review) => {
      const sentences = review.text.split(/[.!?]+/).filter((s) => s.trim().length > 10);

      sentences.forEach((sentence) => {
        const lowerSentence = sentence.toLowerCase();

        // Check for positive phrases
        const hasPositive = this.POSITIVE_WORDS.some((word) =>
          lowerSentence.includes(word)
        );
        if (hasPositive && positive.length < 3) {
          positive.push(sentence.trim().slice(0, 100));
        }

        // Check for negative phrases
        const hasNegative = this.NEGATIVE_WORDS.some((word) =>
          lowerSentence.includes(word)
        );
        if (hasNegative && negative.length < 3) {
          negative.push(sentence.trim().slice(0, 100));
        }
      });
    });

    return {
      positive: [...new Set(positive)].slice(0, 3),
      negative: [...new Set(negative)].slice(0, 3),
    };
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();
