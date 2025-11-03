import { describe, it, expect } from 'bun:test';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

function createContext(user: any): ExecutionContext {
	return {
		switchToHttp: () => ({
			getRequest: () => ({ user }),
		}),
		getHandler: () => ({} as any),
		getClass: () => ({} as any),
		getType: () => 'http',
	} as ExecutionContext;
}

describe('RolesGuard', () => {
	it('allows access when no roles required', () => {
		const reflector = new Reflector();
		(reflector as any).getAllAndOverride = () => undefined;
		const guard = new RolesGuard(reflector);
		expect(guard.canActivate(createContext({ role: 'user' }))).toBe(true);
	});

	it('allows access for matching role', () => {
		const reflector = new Reflector();
		(reflector as any).getAllAndOverride = () => ['admin'];
		const guard = new RolesGuard(reflector);
		expect(guard.canActivate(createContext({ role: 'admin' }))).toBe(true);
	});

	it('denies access for non-matching role', () => {
		const reflector = new Reflector();
		(reflector as any).getAllAndOverride = () => ['admin'];
		const guard = new RolesGuard(reflector);
		expect(() => guard.canActivate(createContext({ role: 'user' }))).toThrow(
			ForbiddenException,
		);
	});
});
