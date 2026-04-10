import { describe, expect, it } from 'vitest';

import {
	createCursor,
	decodeCursor,
	encodeCursor,
	parseLimit,
	type CursorType,
} from '../src/lib/server/pagination';

const VALID_ID = '11111111-1111-4111-8111-111111111111';

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
	it('round-trips a valid cursor', () => {
		const cursor = createCursor(new Date('2026-04-10T00:00:00.000Z'), VALID_ID);
		expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
	});

	it('returns null when decoding a missing payload', () => {
		expect(decodeCursor(null)).toBeNull();
	});

	it('returns null for malformed base64', () => {
		expect(decodeCursor('%%%')).toBeNull();
	});

	it('returns null for malformed json', () => {
		expect(decodeCursor(btoa('{"ts":1'))).toBeNull();
	});

	it('returns null for schema-invalid payloads', () => {
		const invalidCursor = {
			ts: '1',
			id: 'not-a-uuid',
		};

		expect(decodeCursor(btoa(JSON.stringify(invalidCursor)))).toBeNull();
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
