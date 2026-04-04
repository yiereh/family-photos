import { photos } from "$lib/server/db/schema";
import { json } from "@sveltejs/kit";
import { inArray } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { z } from 'zod';

const BatchDeleteSchema = z.object({
  ids: z.array(z.string())
})

// receives: {ids: string[]} 
export const POST: RequestHandler = async ({ locals, request, platform }) => {
  const bucket = platform!.env.BUCKET;
  const db = locals.db;
  const result = BatchDeleteSchema.safeParse(await request.json());
  if (!result.success) {
    return new Response(`invalid request: ${z.prettifyError(result.error)}`, { status: 400 })
  }
  const { ids } = result.data;
  if (ids.length === 0) {
    return json({ deleted: [] });
  }
  const photosToDelete = await db.select({ originalKey: photos.originalKey, thumbnailKey: photos.thumbnailKey }).from(photos).where(inArray(photos.id, ids))

  await db.delete(photos).where(inArray(photos.id, ids))
  await Promise.all(
    photosToDelete.flatMap((photo) => [
      bucket.delete(photo.originalKey),
      bucket.delete(photo.thumbnailKey),
    ])
  )

  return json({ deleted: ids })
}