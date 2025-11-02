import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DatabaseHealthIndicator } from './database.health';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private database: DatabaseHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return this.health.check([
      // Database health
      () => this.database.isHealthy('database'),

      // Redis health
      () => this.redis.isHealthy('redis'),

      // Memory health - heap size
      () =>
        this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB

      // Memory health - RSS
      () =>
        this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB

      // Disk health
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9, // Alert if disk usage > 90%
        }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check endpoint' })
  ready() {
    return this.health.check([
      () => this.database.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness check endpoint' })
  live() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}

