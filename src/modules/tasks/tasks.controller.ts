import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { TaskStatus } from './enums/task-status.enum';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@RateLimit({ limit: 100, windowMs: 60000 })
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Find all tasks with optional filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() filterDto: FilterTasksDto) {
    // Use DTO validation and database-level filtering
    return this.tasksService.findAll(filterDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics using SQL aggregation' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats() {
    // Use optimized SQL aggregation instead of in-memory filtering
    return this.tasksService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a task by ID' })
  @ApiResponse({ status: 200, description: 'Task retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string) {
    // Service handles NotFoundException with proper error handling
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    // Service validates task exists and uses transactions
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 204, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id') id: string) {
    // Service validates task exists before deletion
    await this.tasksService.remove(id);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch process multiple tasks using bulk operations' })
  @ApiResponse({ status: 200, description: 'Batch operation completed' })
  @ApiResponse({ status: 400, description: 'Invalid batch operation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async batchProcess(
    @Body()
    operations: {
      tasks: string[];
      action: 'complete' | 'delete' | 'update';
      updateData?: Partial<UpdateTaskDto>;
    },
  ) {
    const { tasks: taskIds, action, updateData } = operations;

    if (!taskIds || taskIds.length === 0) {
      return { success: false, message: 'No task IDs provided' };
    }

    try {
      switch (action) {
        case 'complete':
          await this.tasksService.batchUpdate(taskIds, {
            status: TaskStatus.COMPLETED,
          });
          return {
            success: true,
            message: `${taskIds.length} tasks marked as completed`,
            affected: taskIds.length,
          };

        case 'delete':
          const deletedCount = await this.tasksService.batchDelete(taskIds);
          return {
            success: true,
            message: `${deletedCount} tasks deleted`,
            affected: deletedCount,
          };

        case 'update':
          if (!updateData) {
            return {
              success: false,
              message: 'updateData required for update action',
            };
          }
          await this.tasksService.batchUpdate(taskIds, updateData);
          return {
            success: true,
            message: `${taskIds.length} tasks updated`,
            affected: taskIds.length,
          };

        default:
          return {
            success: false,
            message: `Unknown action: ${action}. Supported actions: complete, delete, update`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
} 