import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../services/redis-cache.service';
import { createHash } from 'crypto';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyGenerator?: (request: any) => string;
}

// Metadata key for storing rate limit options
export const RATE_LIMIT_KEY = 'rate_limit';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly defaultLimit: number;
  private readonly defaultWindowMs: number;

  constructor(
    private reflector: Reflector,
    private readonly cacheService: RedisCacheService,
    private readonly configService: ConfigService,
  ) {
    this.defaultLimit = this.configService.get<number>('RATE_LIMIT_MAX') || 100;
    this.defaultWindowMs =
      (this.configService.get<number>('RATE_LIMIT_TTL') || 60) * 1000;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get rate limit options from decorator metadata
    const rateLimitOptions =
      this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, handler) ||
      this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, controller);

    const limit = rateLimitOptions?.limit || this.defaultLimit;
    const windowMs = rateLimitOptions?.windowMs || this.defaultWindowMs;
    const keyGenerator =
      rateLimitOptions?.keyGenerator || this.defaultKeyGenerator;

    // Generate rate limit key
    const key = keyGenerator(request);
    const cacheKey = `rate_limit:${key}`;

    // Use sliding window algorithm with Redis
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get current count from Redis
    const currentCount = await this.getCurrentCount(
      cacheKey,
      windowStart,
      windowMs,
    );

    if (currentCount >= limit) {
      const ttl = await this.cacheService.getClient().ttl(cacheKey);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds.`,
          limit,
          current: currentCount,
          remaining: 0,
          retryAfter: Math.ceil((ttl > 0 ? ttl : windowMs) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment count
    await this.incrementCount(cacheKey, now, windowMs);

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount - 1));
    response.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

    return true;
  }

  /**
   * Get current request count using sliding window
   */
  private async getCurrentCount(
    key: string,
    windowStart: number,
    windowMs: number,
  ): Promise<number> {
    try {
      // Use sorted set to store request timestamps
      const client = this.cacheService.getClient();
      
      // Remove expired entries
      await client.zremrangebyscore(key, 0, windowStart);
      
      // Count entries in the window
      const count = await client.zcard(key);
      return count;
    } catch (error) {
      // If Redis fails, allow the request (graceful degradation)
      return 0;
    }
  }

  /**
   * Increment request count
   */
  private async incrementCount(
    key: string,
    timestamp: number,
    windowMs: number,
  ): Promise<void> {
    try {
      const client = this.cacheService.getClient();
      const pipeline = client.pipeline();
      
      // Add current request timestamp
      pipeline.zadd(key, timestamp, timestamp);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(windowMs / 1000));
      
      await pipeline.exec();
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to increment rate limit:', error);
    }
  }

  /**
   * Default key generator: hash IP address for privacy
   */
  private defaultKeyGenerator(request: any): string {
    const ip = request.ip || request.connection.remoteAddress || 'unknown';
    
    // Hash IP address for privacy compliance
    // In production, consider using a more secure hashing method
    const hashedIp = createHash('sha256')
      .update(ip)
      .digest('hex')
      .substring(0, 16);
    
    // Optionally include user ID if authenticated
    const userId = request.user?.id;
    if (userId) {
      return `${hashedIp}:${userId}`;
    }
    
    return hashedIp;
  }
} 