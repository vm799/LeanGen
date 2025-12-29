import { SentimentAnalysis, PlaceReview } from '../types';

const POSITIVE_WORDS = [
  'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best',
  'perfect', 'awesome', 'outstanding', 'highly recommend', 'professional',
  'friendly', 'clean', 'helpful',
];

const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'worst', 'disappointing', 'rude',
  'unprofessional', 'dirty', 'slow', 'overpriced', 'never again', 'waste',
  'poor', 'unacceptable',
];

export function analyzeSentiment(reviews: PlaceReview[] | undefined): SentimentAnalysis {
  if (!reviews || reviews.length === 0) {
    return {
      overall: 'MIXED',
      score: 0,
      distribution: { positive: 0, neutral: 0, negative: 0 },
      recentTrend: 'STABLE',
      keyPhrases: { positive: [], negative: [] },
    };
  }

  try {
    const reviewScores = reviews.map((review) => ({
      rating: review.rating,
      time: review.time,
    }));

    // Calculate distribution
    const positive = reviewScores.filter((r) => r.rating >= 4).length;
    const negative = reviewScores.filter((r) => r.rating <= 2).length;
    const neutral = reviewScores.length - positive - negative;

    // Calculate overall sentiment
    const avgRating = reviewScores.reduce((sum, r) => sum + r.rating, 0) / reviewScores.length;
    let overall: 'POSITIVE' | 'MIXED' | 'NEGATIVE';
    if (avgRating >= 4.0) overall = 'POSITIVE';
    else if (avgRating >= 3.0) overall = 'MIXED';
    else overall = 'NEGATIVE';

    // Calculate sentiment score (-1 to 1)
    const score = (avgRating - 3) / 2;

    // Determine recent trend
    const recentTrend = calculateTrend(reviewScores);

    // Extract key phrases
    const keyPhrases = extractKeyPhrases(reviews);

    return {
      overall,
      score,
      distribution: { positive, neutral, negative },
      recentTrend,
      keyPhrases,
    };
  } catch {
    return {
      overall: 'MIXED',
      score: 0,
      distribution: { positive: 0, neutral: 0, negative: 0 },
      recentTrend: 'STABLE',
      keyPhrases: { positive: [], negative: [] },
    };
  }
}

function calculateTrend(
  reviewScores: Array<{ rating: number; time: number }>
): 'IMPROVING' | 'STABLE' | 'DECLINING' {
  if (reviewScores.length < 6) return 'STABLE';

  const sorted = [...reviewScores].sort((a, b) => b.time - a.time);
  const recentAvg = sorted.slice(0, 5).reduce((sum, r) => sum + r.rating, 0) / 5;
  const previousAvg = sorted.slice(5, 10).reduce((sum, r) => sum + r.rating, 0) / Math.min(5, sorted.length - 5);

  const diff = recentAvg - previousAvg;
  if (diff > 0.3) return 'IMPROVING';
  if (diff < -0.3) return 'DECLINING';
  return 'STABLE';
}

function extractKeyPhrases(reviews: PlaceReview[]): { positive: string[]; negative: string[] } {
  const positive: string[] = [];
  const negative: string[] = [];

  reviews.forEach((review) => {
    const sentences = review.text.split(/[.!?]+/).filter((s) => s.trim().length > 10);

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();

      if (POSITIVE_WORDS.some((word) => lowerSentence.includes(word)) && positive.length < 3) {
        positive.push(sentence.trim().slice(0, 100));
      }

      if (NEGATIVE_WORDS.some((word) => lowerSentence.includes(word)) && negative.length < 3) {
        negative.push(sentence.trim().slice(0, 100));
      }
    });
  });

  return {
    positive: [...new Set(positive)].slice(0, 3),
    negative: [...new Set(negative)].slice(0, 3),
  };
}
