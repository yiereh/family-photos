import { photos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { createR2S3Client, createPresignedDownloadUrl } from '$lib/server/r2';


export const GET: RequestHandler = async ({ params, platform, locals }) => {
  const env = platform!.env;
  const db = locals.db;

  const photo = await db
    .select({ filename: photos.filename, originalKey: photos.originalKey })
    .from(photos)
    .where(eq(photos.id, params.id))
    .get();
  if (!photo) {
    return new Response('not found', { status: 404 });
  }

  const client = createR2S3Client(env);
  const downloadUrl = await createPresignedDownloadUrl(client, env.R2_BUCKET_NAME, photo.originalKey, photo.filename);

  return new Response(null, { status: 302, headers: { Location: downloadUrl } })
};
