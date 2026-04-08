import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createR2S3Client, createPresignedUploadUrl, URL_EXPIRY_SECONDS } from '$lib/server/r2';
import { z } from 'zod';
import { getOriginalKey } from '$lib/server/key';

const PresignUploadSchema = z.object({
	filename: z.string(),
	contentType: z.string(),
})

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform!.env;

	let body: unknown;
	try {
		body = await request.json();
	} catch (err) {
		error(400, 'invalid json');
	}

	const requestBody = PresignUploadSchema.safeParse(body);
	if (!requestBody.success) {
		error(400, `bad request: ${z.prettifyError(requestBody.error)}`)
	}

	const { contentType } = requestBody.data;
	if (!contentType.startsWith('image/')) {
		error(400, `image must be uploaded`)
	}

	const id = crypto.randomUUID();
	const client = createR2S3Client(env);
	const uploadUrl = await createPresignedUploadUrl(client, env.R2_BUCKET_NAME, getOriginalKey(id), contentType);

	return json({ id, uploadUrl, expiresIn: URL_EXPIRY_SECONDS })
};
