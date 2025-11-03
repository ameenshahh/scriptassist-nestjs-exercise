import { describe, it, expect } from 'bun:test';
import { RateLimitGuard } from '../../../src/common/guards/rate-limit.guard';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';

class MockRedisClient {
	public store = new Map<string, number[]>();
	async zremrangebyscore(key: string, _min: number, threshold: number) {
		const list = this.store.get(key) || [];
		this.store.set(key, list.filter((ts) => ts > threshold));
	}
	async zcard(key: string) {
		return (this.store.get(key) || []).length;
	}
	pipeline() {
		const ops: Array<() => void> = [];
		return {
			zadd: (key: string, _score: number, value: number) => {
				ops.push(() => {
					const list = this.store.get(key) || [];
					list.push(value);
					this.store.set(key, list);
				});
				return this;
			},
			expire: (_key: string, _ttl: number) => {
				return this;
			},
			exec: async () => {
				ops.forEach((fn) => fn());
			},
		};
	}
	async ttl() {
		return 10;
	}
}

class MockCacheService {
	client = new MockRedisClient();
	getClient() {
		return this.client as any;
	}
}

function createContext(ip: string): ExecutionContext {
	return {
		switchToHttp: () => ({
			getRequest: () => ({ ip }),
			getResponse: () => ({ setHeader: () => undefined }),
		}),
		getHandler: () => ({} as any),
		getClass: () => ({} as any),
		// @ts-expect-error
		getType: () => 'http',
	} as ExecutionContext;
}

describe('RateLimitGuard', () => {
	it('allows requests under the limit and increments count', async () => {
		const guard = new RateLimitGuard(
			new Reflector(),
			new MockCacheService() as any,
			{ get: () => 5 } as unknown as ConfigService,
		);
		const ctx = createContext('1.1.1.1');
		const res1 = await guard.canActivate(ctx);
		const res2 = await guard.canActivate(ctx);
		expect(res1).toBe(true);
		expect(res2).toBe(true);
	});
});
