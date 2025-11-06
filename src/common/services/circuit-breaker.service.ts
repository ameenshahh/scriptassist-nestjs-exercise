import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { ConfigService } from '@nestjs/config';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  enabled?: boolean;
  fallback?: () => any;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private breakers: Map<string, CircuitBreaker> = new Map();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Create or get a circuit breaker for a service
   */
  createCircuitBreaker<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    options?: CircuitBreakerOptions,
  ): CircuitBreaker {
    // Return existing breaker if it exists
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const defaultOptions = {
      timeout: this.configService.get<number>('CIRCUIT_BREAKER_TIMEOUT') || 3000,
      errorThresholdPercentage: this.configService.get<number>('CIRCUIT_BREAKER_ERROR_THRESHOLD') || 50,
      resetTimeout: this.configService.get<number>('CIRCUIT_BREAKER_RESET_TIMEOUT') || 30000,
      enabled: this.configService.get<boolean>('CIRCUIT_BREAKER_ENABLED') !== false,
    };

    const breakerOptions = {
      ...defaultOptions,
      ...options,
    };

    const breaker = new CircuitBreaker(fn, breakerOptions);

    // Event handlers
    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker "${name}" opened`);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker "${name}" half-open`);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit breaker "${name}" closed`);
    });

    breaker.on('failure', (error: Error) => {
      this.logger.error(`Circuit breaker "${name}" failure: ${error.message}`);
    });

    // Set fallback if provided
    if (options?.fallback) {
      breaker.fallback(options.fallback);
    }

    this.breakers.set(name, breaker);

    return breaker;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    options?: CircuitBreakerOptions,
  ): Promise<T> {
    const breaker = this.createCircuitBreaker(name, fn, options);
    return breaker.fire() as Promise<T>;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(name: string): any {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    return {
      name,
      opened: breaker.opened,
      closed: breaker.closed,
      halfOpen: breaker.halfOpen,
      stats: breaker.stats,
    };
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = this.getStats(name);
    });
    return stats;
  }
}

