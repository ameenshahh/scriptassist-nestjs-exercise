import { describe, it, expect } from 'bun:test';
import { TasksService } from '../../../src/modules/tasks/tasks.service';
import { Repository } from 'typeorm';
import { Task } from '../../../src/modules/tasks/entities/task.entity';

function createService(found: Task | null) {
	const repo = {
		findOne: async () => found,
		delete: async () => ({ affected: 1 }),
	} as unknown as Repository<Task>;
	const queue = { add: async () => undefined } as any;
	const dataSource = { createQueryRunner: () => ({ connect: async () => {}, startTransaction: async () => {}, commitTransaction: async () => {}, rollbackTransaction: async () => {}, release: async () => {}, manager: { save: async (_t: any, obj: any) => obj, findOne: async () => found, merge: () => {} } }) } as any;
	return new TasksService(repo, queue, dataSource);
}

describe('TasksService.findOne', () => {
	it('returns task when found', async () => {
		const task = { id: 'id-1', title: 't', user: { id: 'u' } } as any;
		const service = createService(task);
		const result = await service.findOne('id-1');
		expect(result).toBe(task);
	});

	it('throws when not found', async () => {
		const service = createService(null);
		await expect(service.findOne('missing')).rejects.toThrow('Task with ID missing not found');
	});
});
