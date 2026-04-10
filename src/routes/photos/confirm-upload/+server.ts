import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { photos } from '$lib/server/db/schema';
import { z } from 'zod';
import { getOriginalKey, getThumbnailKey } from '$lib/server/key';
import { ConfirmUploadRequest } from '$lib/api';

// verify that the user actually uploaded original and thumbnail image to bucket by first fetching file metadata for confirming the existence.
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const bucket = platform!.env.BUCKET;

	let body: unknown;
	try {
		body = await request.json();
	} catch (err) {
		error(400, `invalid json: ${err}`)
	}

	// parse request json
	const result = ConfirmUploadRequest.safeParse(body);
	if (!result.success) {
		error(400, `bad request: ${z.prettifyError(result.error)}`);
	}
	const { id, filename, originalType, thumbnailType, description } = result.data;

	// confirm original image object is on R2
	const originalKey = getOriginalKey(id)
	const originalMeta = await bucket.head(originalKey)
	if (!originalMeta) {
		error(404, "object not found")
	}

	// do the same for thumbnail, but allow failure
	let thumbnailKey: string | undefined;
	let thumbnailCreated = false;
	if (thumbnailType) {
		thumbnailKey = getThumbnailKey(id, thumbnailType);
		thumbnailCreated = await bucket.head(thumbnailKey) ? true : false;
	}

	// insert metadata of the original image now that the upload is confirmed
	const uploadedBy = request.headers.get("Cf-Access-Authenticated-User-Email")
	try {

		await locals.db.insert(photos).values({ id: id, originalKey: originalKey, thumbnailKey: thumbnailCreated ? thumbnailKey! : null, filename: filename, mimeType: originalType, sizeBytes: originalMeta.size, description: description ?? "", uploadedBy: uploadedBy, uploadedAt: new Date() })

	} catch (err) {
		await bucket.delete(originalKey);
		if (thumbnailKey) await bucket.delete(thumbnailKey);
		return error(500, "failed to save photo metadata")
	}

	return json({ id: id, originalFilename: filename, thumbnailCreated }, { status: 201 })

};