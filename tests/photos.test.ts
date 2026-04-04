import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from './setup';

beforeAll(async () => {
	await applyMigrations();
});

// Helper: create a minimal PNG file (1x1 pixel)
function makePng(): ArrayBuffer {
	const base64 =
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

const ORIGIN = 'http://localhost';

async function uploadPhoto(description = 'test photo') {
	const form = new FormData();
	form.append('file', new File([makePng()], 'test.png', { type: 'image/png' }));
	form.append('description', description);
	const res = await SELF.fetch(`${ORIGIN}/photos`, {
		method: 'POST',
		body: form,
		headers: { Origin: ORIGIN }
	});
	return res;
}

describe('POST /photos', () => {
	it('uploads a photo and returns 201', async () => {
		const res = await uploadPhoto();
		expect(res.status).toBe(201);
		const body = await res.json<{ id: string; filename: string }>();
		expect(body.id).toBeDefined();
		expect(body.filename).toBe('test.png');
	});

	it('rejects non-image files', async () => {
		const form = new FormData();
		form.append('file', new File(['hello'], 'test.txt', { type: 'text/plain' }));
		const res = await SELF.fetch(`${ORIGIN}/photos`, { method: 'POST', body: form, headers: { Origin: ORIGIN } });
		expect(res.status).toBe(400);
	});

	it('rejects missing file', async () => {
		const form = new FormData();
		const res = await SELF.fetch(`${ORIGIN}/photos`, { method: 'POST', body: form, headers: { Origin: ORIGIN } });
		expect(res.status).toBe(400);
	});
});

describe('GET /photos', () => {
	it('lists uploaded photos', async () => {
		const uploadRes = await uploadPhoto('list test');
		expect(uploadRes.status).toBe(201);

		const res = await SELF.fetch('http://localhost/photos');
		expect(res.status).toBe(200);
		const body = await res.json<any[]>();
		expect(body.length).toBeGreaterThan(0);
		expect(body.some((p: any) => p.description === 'list test')).toBe(true);
	});
});

describe('GET /photos/:id/thumbnails', () => {
	it('returns a webp thumbnail', async () => {
		const upload = await (await uploadPhoto()).json<{ id: string }>();
		const res = await SELF.fetch(`http://localhost/photos/${upload.id}/thumbnails`);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/webp');
		expect(res.headers.get('cache-control')).toContain('immutable');
	});

	it('returns 404 for nonexistent photo', async () => {
		const res = await SELF.fetch('http://localhost/photos/nonexistent/thumbnails');
		expect(res.status).toBe(404);
	});
});

describe('GET /photos/:id/download', () => {
	it('returns the original file as attachment', async () => {
		const upload = await (await uploadPhoto()).json<{ id: string }>();
		const res = await SELF.fetch(`http://localhost/photos/${upload.id}/download`);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/png');
		expect(res.headers.get('content-disposition')).toContain('attachment');
		expect(res.headers.get('content-disposition')).toContain('test.png');
	});

	it('returns 404 for nonexistent photo', async () => {
		const res = await SELF.fetch('http://localhost/photos/nonexistent/download');
		expect(res.status).toBe(404);
	});
});

describe('DELETE /photos/:id', () => {
	it('deletes a photo', async () => {
		const upload = await (await uploadPhoto()).json<{ id: string }>();
		const res = await SELF.fetch(`${ORIGIN}/photos/${upload.id}`, { method: 'DELETE', headers: { Origin: ORIGIN } });
		expect(res.status).toBe(200);
		const body = await res.json<{ deleted: string }>();
		expect(body.deleted).toBe(upload.id);

		// verify it's gone
		const check = await SELF.fetch(`http://localhost/photos/${upload.id}/thumbnails`);
		expect(check.status).toBe(404);
	});

	it('returns 404 for nonexistent photo', async () => {
		const res = await SELF.fetch(`${ORIGIN}/photos/nonexistent`, { method: 'DELETE', headers: { Origin: ORIGIN } });
		expect(res.status).toBe(404);
	});
});

describe('POST /photos/batch-delete', () => {
	it('deletes multiple photos', async () => {
		const id1 = (await (await uploadPhoto()).json<{ id: string }>()).id;
		const id2 = (await (await uploadPhoto()).json<{ id: string }>()).id;

		const res = await SELF.fetch(`${ORIGIN}/photos/batch-delete`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
			body: JSON.stringify({ ids: [id1, id2] })
		});
		expect(res.status).toBe(200);
		const body = await res.json<{ deleted: string[] }>();
		expect(body.deleted).toEqual([id1, id2]);

		// verify they're gone
		const list = await (await SELF.fetch('http://localhost/photos')).json<any[]>();
		expect(list.find((p: any) => p.id === id1)).toBeUndefined();
		expect(list.find((p: any) => p.id === id2)).toBeUndefined();
	});

	it('returns early for empty ids', async () => {
		const res = await SELF.fetch(`${ORIGIN}/photos/batch-delete`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
			body: JSON.stringify({ ids: [] })
		});
		expect(res.status).toBe(200);
		const body = await res.json<{ deleted: string[] }>();
		expect(body.deleted).toEqual([]);
	});

	it('rejects invalid input', async () => {
		const res = await SELF.fetch(`${ORIGIN}/photos/batch-delete`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
			body: JSON.stringify({ ids: 123 })
		});
		expect(res.status).toBe(400);
	});
});
