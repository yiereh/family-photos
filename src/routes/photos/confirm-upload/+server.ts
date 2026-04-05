import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { photos } from '$lib/server/db/schema';
import { generateThumbnail, writeThumbnail } from '$lib/server/thumbnail';
import { z } from 'zod';
import { getOriginalKey, getThumbnailKey } from '$lib/server/key';

const ConfirmUploadSchema = z.object({
	id: z.string(),
	filename: z.string(),
	contentType: z.string().default("application/octet-stream"),
	description: z.string().optional(),
})

// verify that the user actually uploaded original image to bucket
// by first fetching file metadata for confirming the existence,.
// And then we generate and write back thumbnail and officialy record the metadata to D1.
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const bucket = platform!.env.BUCKET;

	// parse request json
	const result = ConfirmUploadSchema.safeParse(await request.json());
	if (!result.success) {
		error(400, "bad request");
	}
	const { id, filename, contentType, description } = result.data;

	const originalKey = getOriginalKey(id)

	const objMeta = await bucket.head(originalKey)
	if (!objMeta) {
		error(404, "object not found")
	}
	const obj = await bucket.get(originalKey)
	if (!obj) {
		error(500, "failed to fetch object from R2")
	}

	// obtain obj bytes, and convert it into Uint8Array and generate thumbnail, and write it back to bucket
	const thumbnailBytes = generateThumbnail(await obj.bytes());
	const thumbnailKey = getThumbnailKey(id);
	await writeThumbnail(bucket, thumbnailKey, thumbnailBytes);

	// insert metadata of the original image now that the upload is confirmed
	const uploadedBy = request.headers.get("Cf-Access-Authenticated-User-Email")
	try {
		await locals.db.insert(photos).values({ id: id, originalKey: originalKey, thumbnailKey: thumbnailKey, filename: filename, mimeType: contentType, sizeBytes: obj.size, description: description ?? "", uploadedBy: uploadedBy, uploadedAt: new Date() })
	} catch (err) {
		await bucket.delete(thumbnailKey);
		return error(500, "failed to save photo metadata")
	}

	return json({ id: id, filename: filename }, { status: 201 })

};