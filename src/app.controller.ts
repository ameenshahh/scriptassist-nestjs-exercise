import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('root')
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Welcome message' })
  getWelcome() {
    return {
      message: 'Welcome to TaskFlow API',
      version: '1.0.0',
      status: 'running',
      documentation: '/api',
      health: '/health',
    };
  }
}

