import { test, expect } from '@playwright/test';

// 1x1 red pixel PNG
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
	'base64'
);
const MIN_CURSOR_ID = '00000000-0000-4000-8000-000000000000';

async function presignUpload(request: any, baseURL: string) {
	for (let attempt = 0; attempt < 5; attempt++) {
		const response = await request.post(`${baseURL}/photos/presign-upload`, {
			data: { originalType: 'image/png', thumbnailType: 'image/webp' },
		});
		if (response.ok()) {
			return response.json();
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error('failed to presign upload after retries');
}

function encodeCursor(ts: number, id: string): string {
	return Buffer.from(JSON.stringify({ ts, id }), 'utf8').toString('base64');
}

function getUploadedAtMs(photo: { uploadedAt: number | string }): number {
	return typeof photo.uploadedAt === 'number' ? photo.uploadedAt : Date.parse(photo.uploadedAt);
}

function comparePhotos(
	left: { id: string; uploadedAt: number | string },
	right: { id: string; uploadedAt: number | string }
): number {
	const timestampDiff = getUploadedAtMs(left) - getUploadedAtMs(right);
	return timestampDiff !== 0 ? timestampDiff : left.id.localeCompare(right.id);
}

async function listPhotosPage(
	request: any,
	baseURL: string,
	options: { limit?: number | string; cursor?: string } = {}
) {
	const url = new URL('/photos', baseURL);
	if (options.limit !== undefined) {
		url.searchParams.set('limit', String(options.limit));
	}
	if (options.cursor) {
		url.searchParams.set('cursor', options.cursor);
	}

	const response = await request.get(url.toString());
	const body = response.ok() ? await response.json() : null;
	return { response, body };
}

async function listPhotos(request: any, baseURL: string, limit = 100) {
	const { response, body } = await listPhotosPage(request, baseURL, { limit });
	expect(response.ok()).toBe(true);
	return body;
}

async function deletePhotos(request: any, baseURL: string, ids: string[]) {
	if (ids.length === 0) {
		return;
	}

	const response = await request.post(`${baseURL}/photos/batch-delete`, {
		data: { ids },
	});
	expect(response.ok()).toBe(true);
}

/** Upload a photo via the full presign → PUT → confirm flow, return the photo id. */
async function uploadPhoto(request: any, baseURL: string, description = 'test photo') {
	const presign = await presignUpload(request, baseURL);

	// upload original to R2
	const origPut = await request.fetch(presign.originalUploadUrl, {
		method: 'PUT',
		headers: { 'Content-Type': 'image/png' },
		data: TINY_PNG,
	});
	expect(origPut.ok()).toBe(true);

	// upload thumbnail (same tiny PNG, pretending it's webp)
	const thumbPut = await request.fetch(presign.thumbnailUploadUrl, {
		method: 'PUT',
		headers: { 'Content-Type': 'image/webp' },
		data: TINY_PNG,
	});
	expect(thumbPut.ok()).toBe(true);

	// confirm
	const confirmRes = await request.post(`${baseURL}/photos/confirm-upload`, {
		data: {
			id: presign.id,
			filename: 'test.png',
			originalType: 'image/png',
			thumbnailType: 'image/webp',
			description,
		},
	});
	expect(confirmRes.status()).toBe(201);
	return presign.id as string;
}

test.describe('GET /photos', () => {
	test('lists uploaded photos', async ({ request, baseURL }) => {
		const id = await uploadPhoto(request, baseURL!);

		const body = await listPhotos(request, baseURL!);
		expect(body.items.length).toBeGreaterThan(0);
		expect(body.items.some((p: any) => p.id === id)).toBe(true);
	});

	test('paginates forward from a cursor without duplicates', async ({ request, baseURL }) => {
		const uploadedIds: string[] = [];
		const marker = `pagination-${Date.now()}`;
		const startCursor = encodeCursor(Date.now() - 1_000, MIN_CURSOR_ID);

		try {
			for (let index = 0; index < 5; index++) {
				uploadedIds.push(await uploadPhoto(request, baseURL!, `${marker}-${index}`));
			}

			const page1 = await listPhotosPage(request, baseURL!, { limit: 2, cursor: startCursor });
			expect(page1.response.ok()).toBe(true);
			expect(page1.body.items).toHaveLength(2);
			expect(page1.body.nextCursor).toEqual(expect.any(String));

			const page2 = await listPhotosPage(request, baseURL!, {
				limit: 2,
				cursor: page1.body.nextCursor,
			});
			expect(page2.response.ok()).toBe(true);
			expect(page2.body.items).toHaveLength(2);

			const page1Ids = new Set(page1.body.items.map((photo: any) => photo.id));
			for (const photo of page2.body.items) {
				expect(page1Ids.has(photo.id)).toBe(false);
			}
			expect(
				comparePhotos(page1.body.items[page1.body.items.length - 1], page2.body.items[0])
			).toBeLessThan(0);

			const pages = [page1.body, page2.body];
			let nextCursor = page2.body.nextCursor;

			while (nextCursor) {
				const page = await listPhotosPage(request, baseURL!, { limit: 2, cursor: nextCursor });
				expect(page.response.ok()).toBe(true);
				pages.push(page.body);
				nextCursor = page.body.nextCursor;
			}

			expect(pages[pages.length - 1].nextCursor).toBeNull();

			const collectedItems = pages.flatMap((page) => page.items);
			const collectedMarkedIds = collectedItems
				.filter((photo: any) => photo.description?.startsWith(marker))
				.map((photo: any) => photo.id);

			expect(collectedMarkedIds).toEqual(uploadedIds);
		} finally {
			await deletePhotos(request, baseURL!, uploadedIds);
		}
	});

	test('rejects negative limit', async ({ request, baseURL }) => {
		const { response } = await listPhotosPage(request, baseURL!, { limit: -1 });
		expect(response.status()).toBe(400);
	});
});

test.describe('GET /photos/:id/thumbnails', () => {
	test('returns a thumbnail', async ({ request, baseURL }) => {
		const id = await uploadPhoto(request, baseURL!);

		const res = await request.get(`${baseURL}/photos/${id}/thumbnails`);
		expect(res.ok()).toBe(true);
		expect(res.headers()['cache-control']).toContain('immutable');
	});

	test('returns 404 for nonexistent photo', async ({ request, baseURL }) => {
		const res = await request.get(`${baseURL}/photos/nonexistent/thumbnails`);
		expect(res.status()).toBe(404);
	});

	test('returns 404 when thumbnail is missing', async ({ request, baseURL }) => {
		// upload without thumbnail
		const presign = await presignUpload(request, baseURL!);

		await request.fetch(presign.originalUploadUrl, {
			method: 'PUT',
			headers: { 'Content-Type': 'image/png' },
			data: TINY_PNG,
		});

		// confirm without thumbnailType
		await request.post(`${baseURL}/photos/confirm-upload`, {
			data: { id: presign.id, filename: 'test.png', originalType: 'image/png' },
		});

		const res = await request.get(`${baseURL}/photos/${presign.id}/thumbnails`);
		expect(res.status()).toBe(404);
	});
});

test.describe('GET /photos/:id/download', () => {
	test('returns the original file', async ({ request, baseURL }) => {
		const id = await uploadPhoto(request, baseURL!);

		const res = await request.get(`${baseURL}/photos/${id}/download`);
		expect(res.ok()).toBe(true);
		expect(res.headers()['content-type']).toBe('image/png');
		expect(res.headers()['content-disposition']).toContain('attachment');
		expect(res.headers()['content-disposition']).toContain('test.png');
	});

	test('returns 404 for nonexistent photo', async ({ request, baseURL }) => {
		const res = await request.get(`${baseURL}/photos/nonexistent/download`);
		expect(res.status()).toBe(404);
	});
});

test.describe('DELETE /photos/:id', () => {
	test('deletes a photo', async ({ request, baseURL }) => {
		const id = await uploadPhoto(request, baseURL!);

		const res = await request.delete(`${baseURL}/photos/${id}`);
		expect(res.ok()).toBe(true);
		const body = await res.json();
		expect(body.deleted).toBe(id);

		// verify it's gone
		const check = await request.get(`${baseURL}/photos/${id}/thumbnails`);
		expect(check.status()).toBe(404);
	});

	test('returns 404 for nonexistent photo', async ({ request, baseURL }) => {
		const res = await request.delete(`${baseURL}/photos/nonexistent`);
		expect(res.status()).toBe(404);
	});
});

test.describe('POST /photos/batch-delete', () => {
	test('deletes multiple photos', async ({ request, baseURL }) => {
		const id1 = await uploadPhoto(request, baseURL!);
		const id2 = await uploadPhoto(request, baseURL!);

		const res = await request.post(`${baseURL}/photos/batch-delete`, {
			data: { ids: [id1, id2] },
		});
		expect(res.ok()).toBe(true);
		const body = await res.json();
		expect(body.deleted).toEqual([id1, id2]);

		// verify they're gone
		const list = await listPhotos(request, baseURL!);
		expect(list.items.find((p: any) => p.id === id1)).toBeUndefined();
		expect(list.items.find((p: any) => p.id === id2)).toBeUndefined();
	});

	test('returns early for empty ids', async ({ request, baseURL }) => {
		const res = await request.post(`${baseURL}/photos/batch-delete`, {
			data: { ids: [] },
		});
		expect(res.ok()).toBe(true);
		const body = await res.json();
		expect(body.deleted).toEqual([]);
	});

	test('rejects invalid input', async ({ request, baseURL }) => {
		const res = await request.post(`${baseURL}/photos/batch-delete`, {
			data: { ids: 123 },
		});
		expect(res.status()).toBe(400);
	});
});
