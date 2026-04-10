import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createR2S3Client, createPresignedUploadUrl, URL_EXPIRY_SECONDS } from '$lib/server/r2';
import { z } from 'zod';
import { getOriginalKey, getThumbnailKey } from '$lib/server/key';
import { PresignUploadRequest } from '$lib/api';

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform!.env;

	let body: unknown;
	try {
		body = await request.json();
	} catch (err) {
		error(400, 'invalid json');
	}

	const requestBody = PresignUploadRequest.safeParse(body);
	if (!requestBody.success) {
		error(400, `bad request: ${z.prettifyError(requestBody.error)}`)
	}

	const { originalType, thumbnailType } = requestBody.data;
	if (!originalType.startsWith('image/')) {
		error(400, `image must be uploaded`)
	}


	const id = crypto.randomUUID();
	const originalKey = getOriginalKey(id);
	const thumbnailKey = getThumbnailKey(id, thumbnailType);
	const client = createR2S3Client(env);

	const originalUploadUrl = await createPresignedUploadUrl(client, env.R2_BUCKET_NAME, originalKey, originalType);
	const thumbnailUploadUrl = await createPresignedUploadUrl(client, env.R2_BUCKET_NAME, thumbnailKey, thumbnailType);

	return json({ id, originalUploadUrl, thumbnailUploadUrl, expiresIn: URL_EXPIRY_SECONDS })
};