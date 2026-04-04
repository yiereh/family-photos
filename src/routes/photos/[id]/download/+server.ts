import { photos } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, platform, locals }) => {
  const bucket = platform!.env.BUCKET;
  const db = locals.db;

  const photo = await db.select({ filename: photos.filename, originalKey: photos.originalKey }).from(photos).where(eq(photos.id, params.id)).get();
  if (!photo) {
    return new Response('not found', { status: 404 })
  }

  const object = await bucket.get(photo.originalKey);
  if (!object) {
    return new Response('not found', { status: 404 })
  }

  return new Response(object.body,
    {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(photo.filename)}`
      }
    })
}