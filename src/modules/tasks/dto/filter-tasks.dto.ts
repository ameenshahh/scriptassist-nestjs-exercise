import { IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';

export class FilterTasksDto {
  @ApiProperty({
    enum: TaskStatus,
    required: false,
    description: 'Filter by task status',
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({
    enum: TaskPriority,
    required: false,
    description: 'Filter by task priority',
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({
    required: false,
    description: 'Filter by user ID',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    required: false,
    minimum: 1,
    default: 1,
    description: 'Page number (starts from 1)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    required: false,
    minimum: 1,
    maximum: 100,
    default: 10,
    description: 'Number of items per page',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({
    required: false,
    description: 'Sort field (createdAt, updatedAt, dueDate, priority)',
    default: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    required: false,
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    description: 'Sort order',
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

