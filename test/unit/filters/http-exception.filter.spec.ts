import { describe, it, expect } from 'bun:test';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

function createHost(): { host: ArgumentsHost; body: any } {
	const body: any = {};
	const response = {
		status: (code: number) => ({
			json: (obj: any) => {
				body.status = code;
				body.data = obj;
			},
		}),
	} as any;
	const request = {
		url: '/tasks/1',
		method: 'GET',
		ip: '127.0.0.1',
		get: () => 'jest',
		connection: { remoteAddress: '127.0.0.1' },
	} as any;
	const host = {
		switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
	} as any as ArgumentsHost;
	return { host, body };
}

describe('HttpExceptionFilter', () => {
	it('strips sensitive data from response', () => {
		const configService = { get: () => 'production' } as any;
		const filter = new HttpExceptionFilter(configService);
		const { host, body } = createHost();
		const exception = new HttpException(
			{ message: 'Forbidden', password: 'secret', token: 'abc' },
			HttpStatus.FORBIDDEN,
		);
		filter.catch(exception, host);
		expect(body.status).toBe(403);
		expect(body.data.message).toBe('Forbidden');
		expect(body.data.details?.password).toBeUndefined();
		expect(body.data.details?.token).toBeUndefined();
	});
});
