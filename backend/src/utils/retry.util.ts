import { logger } from './logger.util';

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoff: boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, backoff = true } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = backoff ? delayMs * Math.pow(2, attempt) : delayMs;
        logger.warn(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`
        );
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
