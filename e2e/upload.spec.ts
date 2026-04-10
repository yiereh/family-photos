import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Create a small 100x100 PNG for fast uploads to remote R2
function createTestPng(): string {
	const tmpPath = path.join(os.tmpdir(), 'playwright-test-photo.png');
	if (fs.existsSync(tmpPath)) return tmpPath;

	// 1x1 red pixel PNG (smallest valid PNG)
	const base64 =
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
	fs.writeFileSync(tmpPath, Buffer.from(base64, 'base64'));
	return tmpPath;
}

const TEST_IMAGE = createTestPng();

test('full upload flow with client-side thumbnail', async ({ page }) => {
	await page.goto('/test/upload');
	await page.waitForLoadState('networkidle');

	const input = page.getByTestId('file-input');
	await input.setInputFiles(TEST_IMAGE);

	// wait for the full flow to complete
	await expect(page.getByTestId('status')).toHaveText('done', { timeout: 30_000 });

	// confirm succeeded
	const resultId = await page.getByTestId('result-id').textContent();
	expect(resultId).toBeTruthy();
	expect(resultId!.length).toBeGreaterThan(0);

	// thumbnail was created
	await expect(page.getByTestId('thumbnail-created')).toHaveText('true');

	// thumbnail type is webp (Chromium supports it)
	await expect(page.getByTestId('thumbnail-type')).toHaveText('image/webp');

	// thumbnail size is reasonable (should be much smaller than 4.6MB original)
	const thumbSize = Number(await page.getByTestId('thumbnail-size').textContent());
	expect(thumbSize).toBeGreaterThan(0);
	expect(thumbSize).toBeLessThan(200_000); // under 200KB for a 400px thumbnail
});

test('thumbnail dimensions are within 400px', async ({ page }) => {
	await page.goto('/test/upload');
	await page.waitForLoadState('networkidle');

	const input = page.getByTestId('file-input');
	await input.setInputFiles(TEST_IMAGE);

	await expect(page.getByTestId('status')).toHaveText('done', { timeout: 30_000 });

	const width = Number(await page.getByTestId('thumbnail-width').textContent());
	const height = Number(await page.getByTestId('thumbnail-height').textContent());

	expect(Math.max(width, height)).toBeLessThanOrEqual(400);
	expect(Math.max(width, height)).toBeGreaterThan(0);
});

test('upload flow without thumbnail gracefully degrades', async ({ page }) => {
	await page.goto('/test/upload');
	await page.waitForLoadState('networkidle');

	// intercept and abort the thumbnail PUT to R2
	await page.route('**/thumbnails/**', (route) => route.abort());

	const input = page.getByTestId('file-input');
	await input.setInputFiles(TEST_IMAGE);

	await expect(page.getByTestId('status')).toHaveText('done', { timeout: 30_000 });

	// confirm succeeded but without thumbnail
	const resultId = await page.getByTestId('result-id').textContent();
	expect(resultId).toBeTruthy();
	await expect(page.getByTestId('thumbnail-created')).toHaveText('false');
});

test('rejects non-image file', async ({ page }) => {
	await page.goto('/test/upload');
	await page.waitForLoadState('networkidle');

	// create a temporary text file for upload
	const input = page.getByTestId('file-input');

	// remove accept attribute so we can upload non-image
	await page.evaluate(() => {
		document.querySelector('[data-testid="file-input"]')?.removeAttribute('accept');
	});

	// upload a text file by writing one inline
	await input.setInputFiles({
		name: 'test.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('not an image'),
	});

	await expect(page.getByTestId('status')).toHaveText('error', { timeout: 10_000 });
	await expect(page.getByTestId('error')).toContainText('presign failed: 400');
});
