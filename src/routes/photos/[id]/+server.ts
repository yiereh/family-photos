import { photos } from "$lib/server/db/schema";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
  const db = locals.db;
  const bucket = platform!.env.BUCKET;

  const photo = await db.select({ originalKey: photos.originalKey, thumbnailKey: photos.thumbnailKey }).from(photos).where(eq(photos.id, params.id)).get();
  if (!photo) {
    return new Response('not found', { status: 404 })
  }

  await db.delete(photos).where(eq(photos.id, params.id))
  await Promise.all([
    bucket.delete(photo.originalKey),
    bucket.delete(photo.thumbnailKey),
  ]);


  return json({ deleted: params.id })
}