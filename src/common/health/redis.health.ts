import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisCacheService } from '../services/redis-cache.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly cacheService: RedisCacheService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Try to ping Redis
      const client = this.cacheService.getClient();
      const pong = await client.ping();

      if (pong === 'PONG') {
        return this.getStatus(key, true, {
          message: 'Redis is healthy',
          connection: 'connected',
        });
      }

      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, {
          message: 'Redis ping failed',
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, {
          message: 'Redis connection failed',
          error: message,
        }),
      );
    }
  }
}

