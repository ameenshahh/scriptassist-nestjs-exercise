import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Namespace for key isolation
}

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;
  private defaultTTL: number = 300; // 5 minutes
  private defaultNamespace: string = 'app';

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = this.configService.get<number>('REDIS_DB') || 0;

    this.client = new Redis({
      host,
      port,
      password,
      db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (error) => {
      this.logger.error(`Redis client error: ${error.message}`, error.stack);
    });

    this.client.on('ready', () => {
      this.logger.log('Redis client ready');
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error}`);
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis client disconnected');
  }

  /**
   * Build cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || this.defaultNamespace;
    return `${ns}:${key}`;
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    options?: CacheOptions,
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const ttl = ttlSeconds || options?.ttl || this.defaultTTL;
      
      // Serialize value to JSON
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.client.setex(fullKey, ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}: ${error}`);
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const value = await this.client.get(fullKey);

      if (!value) {
        return null;
      }

      // Deserialize JSON value
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete cache key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deleteByPattern(pattern: string, options?: CacheOptions): Promise<number> {
    try {
      const namespace = options?.namespace || this.defaultNamespace;
      const fullPattern = `${namespace}:${pattern}`;
      
      const stream = this.client.scanStream({
        match: fullPattern,
        count: 100,
      });

      let deletedCount = 0;
      
      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          const count = await this.client.del(...keys);
          deletedCount += count;
        }
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to delete keys by pattern ${pattern}: ${error}`);
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  async has(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check cache key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Clear all cache entries in a namespace
   */
  async clear(namespace?: string): Promise<void> {
    try {
      const ns = namespace || this.defaultNamespace;
      const pattern = `${ns}:*`;
      
      const stream = this.client.scanStream({
        match: pattern,
        count: 100,
      });

      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to clear cache: ${error}`);
      throw error;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map((key) => this.buildKey(key, options?.namespace));
      const values = await this.client.mget(...fullKeys);

      return values.map((value) => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error(`Failed to get multiple cache keys: ${error}`);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset<T>(
    keyValuePairs: Array<{ key: string; value: T; ttl?: number }>,
    options?: CacheOptions,
  ): Promise<void> {
    try {
      const pipeline = this.client.pipeline();
      const namespace = options?.namespace || this.defaultNamespace;

      for (const { key, value, ttl } of keyValuePairs) {
        const fullKey = this.buildKey(key, namespace);
        const serializedValue = JSON.stringify(value);
        
        if (ttl && ttl > 0) {
          pipeline.setex(fullKey, ttl, serializedValue);
        } else {
          pipeline.set(fullKey, serializedValue);
        }
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Failed to set multiple cache keys: ${error}`);
      throw error;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, options?: CacheOptions): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      return await this.client.incr(fullKey);
    } catch (error) {
      this.logger.error(`Failed to increment cache key ${key}: ${error}`);
      throw error;
    }
  }

  /**
   * Get cache statistics (requires Redis INFO command)
   */
  async getStats(): Promise<{
    hits?: number;
    misses?: number;
    keyspace?: any;
  }> {
    try {
      const info = await this.client.info('stats');
      const keyspace = await this.client.info('keyspace');

      return {
        keyspace: this.parseInfo(keyspace),
      };
    } catch (error) {
      this.logger.warn(`Failed to get cache stats: ${error}`);
      return {};
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line && !line.startsWith('#') && line.includes(':')) {
        const [key, value] = line.split(':');
        result[key.trim()] = value.trim();
      }
    }

    return result;
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }
}

