import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './modules/auth/auth.module';
import { TaskProcessorModule } from './queues/task-processor/task-processor.module';
import { ScheduledTasksModule } from './queues/scheduled-tasks/scheduled-tasks.module';
import { CacheModule } from './common/services/cache.module';
import { HealthModule } from './common/health/health.module';
import { AppController } from './app.controller';
import jwtConfig from './config/jwt.config';
import bullConfig from './config/bull.config';
import { validate } from './config/env.validation';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, bullConfig],
      validate,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),

    // Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const bullConf = configService.get('bull');
        return {
          connection: {
            ...bullConf.connection,
            retryStrategy: (times: number) => {
              if (times > 10) {
                return null;
              }
              return Math.min(times * 100, 3000);
            },
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
            showFriendlyErrorStack: true,
          },
        };
      },
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ([
        {
          ttl: 60,
          limit: 10,
        },
      ]),
    }),

    // Cache module (distributed Redis cache)
    CacheModule,

    // Health check module
    HealthModule,

    // Feature modules
    UsersModule,
    TasksModule,
    AuthModule,

    // Queue processing modules
    TaskProcessorModule,
    ScheduledTasksModule,
  ],
  controllers: [AppController],
  providers: [],
  exports: [],
})
export class AppModule {} 