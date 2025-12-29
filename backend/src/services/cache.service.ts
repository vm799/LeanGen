import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger.util';

class CacheService {
  private client: Redis;
  private connected: boolean = false;

  constructor() {
    this.client = new Redis(config.redis.url, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      this.connected = true;
      logger.info('✅ Redis connected');
    });

    this.client.on('error', (err) => {
      this.connected = false;
      logger.error(`Redis error: ${err.message}`);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}: ${error}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.connected) return;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}: ${error}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}: ${error}`);
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.connected) throw new Error('Cache unavailable');

    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Cache incr error for key ${key}: ${error}`);
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}: ${error}`);
    }
  }

  async ping(): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const cacheService = new CacheService();
