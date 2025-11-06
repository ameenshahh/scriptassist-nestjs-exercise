import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Try to execute a simple query
      await this.dataSource.query('SELECT 1');
      
      return this.getStatus(key, true, {
        message: 'Database is healthy',
        connection: 'connected',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, {
          message: 'Database connection failed',
          error: message,
        }),
      );
    }
  }
}

