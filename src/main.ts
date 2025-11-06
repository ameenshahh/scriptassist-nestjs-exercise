import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  
  // Security Headers (OWASP Compliance)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow Swagger UI to work
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // CORS Configuration with proper origin restrictions
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS')?.split(',') || ['http://localhost:3000'];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Request Size Limits
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));

  // Global validation pipe with enhanced security
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: configService.get('NODE_ENV') === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Global exception filter to remove sensitive data
  app.useGlobalFilters(new HttpExceptionFilter(configService));

  // Swagger documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TaskFlow API')
      .setDescription('Task Management System API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = configService.get<number>('PORT') || 3000;
  
  try {
    await app.listen(port);
    logger.log(`Application running on: http://localhost:${port}`);
    if (configService.get('NODE_ENV') !== 'production') {
      logger.log(`Swagger documentation: http://localhost:${port}/api`);
    }
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      logger.error(
        `Port ${port} is already in use. Please kill the process using that port or use a different port.`,
      );
      logger.error(
        `To kill the process, run: lsof -ti:${port} | xargs kill -9`,
      );
      process.exit(1);
    } else {
      logger.error('Failed to start application:', error);
      throw error;
    }
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM signal received: closing HTTP server');
    await app.close();
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT signal received: closing HTTP server');
    await app.close();
    process.exit(0);
  });
}
bootstrap(); 