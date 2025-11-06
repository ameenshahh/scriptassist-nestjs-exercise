import {
  Injectable,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder, In } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { PaginationInterface } from '../../types/pagination.interface';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
    private dataSource: DataSource,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    // Use transaction to ensure consistency between task creation and queue operation
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = this.tasksRepository.create(createTaskDto);
      const savedTask = await queryRunner.manager.save(Task, task);

      // Add to queue with error handling
      try {
        await this.taskQueue.add(
          'task-status-update',
          {
            taskId: savedTask.id,
            status: savedTask.status,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        );
      } catch (queueError) {
        this.logger.warn(
          `Failed to add task ${savedTask.id} to queue: ${queueError}`,
        );
        // Continue even if queue fails - we can retry later
      }

      await queryRunner.commitTransaction();
      return savedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    filterDto: FilterTasksDto,
  ): Promise<PaginationInterface<Task>> {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      userId,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filterDto;

    // Build query with proper joins and filtering at database level
    const queryBuilder: SelectQueryBuilder<Task> =
      this.tasksRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.user', 'user')
        .select([
          'task.id',
          'task.title',
          'task.description',
          'task.status',
          'task.priority',
          'task.dueDate',
          'task.createdAt',
          'task.updatedAt',
          'user.id',
          'user.email',
          'user.name',
        ]);

    // Apply filters at database level
    if (status) {
      queryBuilder.andWhere('task.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority });
    }

    if (userId) {
      queryBuilder.andWhere('task.userId = :userId', { userId });
    }

    // Apply sorting
    const validSortFields = ['createdAt', 'updatedAt', 'dueDate', 'priority'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`task.${sortField}`, sortOrder);

    // Get total count before pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const tasks = await queryBuilder.getMany();

    return {
      data: tasks,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<Task> {
    // Optimized: single query with proper relation loading
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['user'],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    // Use transaction for atomic update
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = await queryRunner.manager.findOne(Task, {
        where: { id },
      });

      if (!task) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      const originalStatus = task.status;

      // Update fields using merge for efficiency
      queryRunner.manager.merge(Task, task, updateTaskDto);
      const updatedTask = await queryRunner.manager.save(Task, task);

      // Add to queue if status changed
      if (originalStatus !== updatedTask.status) {
        try {
          await this.taskQueue.add(
            'task-status-update',
            {
              taskId: updatedTask.id,
              status: updatedTask.status,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
            },
          );
        } catch (queueError) {
          this.logger.warn(
            `Failed to add status update to queue for task ${updatedTask.id}: ${queueError}`,
          );
        }
      }

      await queryRunner.commitTransaction();
      return updatedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    // Optimized: use delete instead of find + remove
    const result = await this.tasksRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    // Use proper repository method with query builder
    return this.tasksRepository.find({
      where: { status },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    // Optimized: use update instead of find + save
    await this.tasksRepository.update(id, { status: status as TaskStatus });

    const task = await this.findOne(id);
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Get task statistics using SQL aggregation
   */
  async getStatistics(): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    highPriority: number;
  }> {
    const stats = await this.tasksRepository
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('task.status')
      .getRawMany();

    const priorityStats = await this.tasksRepository
      .createQueryBuilder('task')
      .where('task.priority = :priority', { priority: 'high' })
      .getCount();

    const total = await this.tasksRepository.count();

    // Initialize counters
    const result = {
      total,
      completed: 0,
      inProgress: 0,
      pending: 0,
      highPriority: priorityStats,
    };

    // Aggregate status counts
    stats.forEach((stat) => {
      const count = parseInt(stat.count, 10);
      switch (stat.status) {
        case TaskStatus.COMPLETED:
          result.completed = count;
          break;
        case TaskStatus.IN_PROGRESS:
          result.inProgress = count;
          break;
        case TaskStatus.PENDING:
          result.pending = count;
          break;
      }
    });

    return result;
  }

  /**
   * Batch update tasks efficiently
   */
  async batchUpdate(
    taskIds: string[],
    updateData: Partial<UpdateTaskDto>,
  ): Promise<void> {
    if (taskIds.length === 0) {
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Task, { id: In(taskIds) }, updateData);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Batch delete tasks efficiently
   */
  async batchDelete(taskIds: string[]): Promise<number> {
    if (taskIds.length === 0) {
      return 0;
    }

    const result = await this.tasksRepository.delete({ id: In(taskIds) });
    return result.affected || 0;
  }
}
