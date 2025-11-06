import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment =
      this.configService.get('NODE_ENV') === 'development';
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract error details without exposing sensitive information
    const errorMessage =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any)?.message || exception.message;

    // Determine if this is a client error (4xx) or server error (5xx)
    const isClientError = status >= 400 && status < 500;
    const isServerError = status >= 500;

    // Log error with appropriate level and context
    const logContext = {
      statusCode: status,
      path: request.url,
      method: request.method,
      ip: this.hashIp(request.ip || request.connection.remoteAddress),
      userAgent: request.get('user-agent'),
      userId: (request as any).user?.id,
    };

    if (isServerError) {
      // Server errors: log with full stack trace
      this.logger.error(
        `Server Error: ${errorMessage}`,
        exception.stack,
        JSON.stringify(logContext),
      );
    } else if (isClientError) {
      // Client errors: log as warning with limited details
      this.logger.warn(
        `Client Error: ${errorMessage}`,
        JSON.stringify(logContext),
      );
    } else {
      this.logger.log(
        `HTTP Exception: ${errorMessage}`,
        JSON.stringify(logContext),
      );
    }

    // Build safe error response (no sensitive data)
    const errorResponse: any = {
      success: false,
      statusCode: status,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Only include stack trace in development
    if (this.isDevelopment && isServerError) {
      errorResponse.stack = exception.stack;
      if (typeof exceptionResponse === 'object') {
        errorResponse.details = exceptionResponse;
      }
    }

    // Remove sensitive fields from error response
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const safeResponse: Record<string, any> = { ...(exceptionResponse as any) };
      delete safeResponse.password;
      delete safeResponse.token;
      delete safeResponse.secret;
      delete safeResponse.apiKey;
      delete safeResponse.ip; // Remove IP from response

      if (!this.isDevelopment) {
        delete safeResponse.stack;
        delete safeResponse.trace;
      }

      if (Object.keys(safeResponse).length > 0 && !errorResponse.details) {
        errorResponse.details = safeResponse;
      }
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Hash IP address for logging (privacy compliance)
   */
  private hashIp(ip: string | undefined): string {
    if (!ip) return 'unknown';
    // Simple hash for privacy - in production, use a proper one-way hash
    return ip.split('.').slice(0, 2).join('.') + '.x.x';
  }
} 