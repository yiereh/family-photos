import { photos } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ platform, params, locals }) => {
  const bucket = platform!.env.BUCKET;
  const db = locals.db;
  const row = await db.select({ thumbnailKey: photos.thumbnailKey }).from(photos).where(eq(photos.id, params.id)).get();
  if (!row || !row.thumbnailKey) {
    return new Response('not found', { status: 404 })
  }
  const object = await bucket.get(row.thumbnailKey);
  if (!object) {
    return new Response('not found', { status: 404 });
  }
  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': object.httpEtag
    }
  });
}