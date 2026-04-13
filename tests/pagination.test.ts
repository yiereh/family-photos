import { describe, expect, it } from 'vitest';

import {
	createCursor,
	decodeCursor,
	encodeCursor,
	parseLimit,
	type CursorType,
} from '../src/lib/server/pagination';

const VALID_ID = '11111111-1111-4111-8111-111111111111';
const VALID_KEY = 'family-photos-test-hmac-key-not-for-production';

describe('parseLimit', () => {
	it('returns null when the param is missing', () => {
		expect(parseLimit(null)).toBeNull();
	});

	it('returns null for non-numeric input', () => {
		expect(parseLimit('abc')).toBeNull();
	});

	it('returns null for zero', () => {
		expect(parseLimit('0')).toBeNull();
	});

	it('returns negative values as-is', () => {
		expect(parseLimit('-1')).toBe(-1);
	});
});

describe('cursor helpers', () => {
	it('round-trips a valid cursor', async () => {
		const cursor = createCursor(new Date('2026-04-10T00:00:00.000Z'), VALID_ID);
		const encodedCursor = await encodeCursor(cursor, VALID_KEY);

		await expect(decodeCursor(encodedCursor, VALID_KEY)).resolves.toEqual(cursor);
	});

	it('returns null when decoding a missing payload', async () => {
		await expect(decodeCursor(null, VALID_KEY)).resolves.toBeNull();
	});

	it('returns null for malformed base64', async () => {
		await expect(decodeCursor('%%%.%%%', VALID_KEY)).resolves.toBeNull();
	});

	it('returns null for malformed json', async () => {
		const malformedPayload = `${btoa('{"ts":1')}.${btoa('not-a-real-signature')}`;

		await expect(decodeCursor(malformedPayload, VALID_KEY)).resolves.toBeNull();
	});

	it('returns null for tampered payloads', async () => {
		const cursor = createCursor(new Date('2026-04-10T00:00:00.000Z'), VALID_ID);
		const encodedCursor = await encodeCursor(cursor, VALID_KEY);
		const [_, signature] = encodedCursor!.split('.');
		const tamperedPayload = `${btoa(JSON.stringify({ ...cursor, ts: cursor.ts + 1 }))}.${signature}`;

		await expect(decodeCursor(tamperedPayload, VALID_KEY)).resolves.toBeNull();
	});

	it('returns null for schema-invalid payloads', async () => {
		const invalidCursor = {
			ts: '1',
			id: 'not-a-uuid',
		};
		const payload = btoa(JSON.stringify(invalidCursor));
		const signature = await crypto.subtle.sign(
			'HMAC',
			await crypto.subtle.importKey(
				'raw',
				new TextEncoder().encode(VALID_KEY),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			),
			new TextEncoder().encode(payload)
		);
		const encodedCursor = `${payload}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

		await expect(decodeCursor(encodedCursor, VALID_KEY)).resolves.toBeNull();
	});

	it('creates cursors using epoch milliseconds', () => {
		const date = new Date('2026-04-10T01:02:03.456Z');
		const cursor = createCursor(date, VALID_ID);

		expect(cursor).toEqual({
			ts: date.getTime(),
			id: VALID_ID,
		} satisfies CursorType);
	});
});
