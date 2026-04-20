import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { photos } from '$lib/server/db/schema'
import { createCursor, decodeCursor, DEFAULT_LIMIT, encodeCursor, parseLimit, type CursorType } from "$lib/server/pagination";
import { and, desc, lt, or } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { createPresignedViewUrl, createR2S3Client } from "$lib/server/r2";
import type { ListPhotosResponse, PhotoListItem } from "$lib/api";

export const GET: RequestHandler = async ({ url, locals, platform }) => {

  const cursor = await decodeCursor(url.searchParams.get("cursor"), platform!.env.CURSOR_SECRET);
  const limit = parseLimit(url.searchParams.get("limit")) ?? DEFAULT_LIMIT;

  // newest first cursor pagenation
  // if a cursor is given, query with (uploadedAt, id) < ($ts, $id) <=> (updateAt < $ts) OR (updateAt = $ts AND id < $id) ORDER BY uploadedAt DESC, id DESC LIMIT limit + 1 to fetch all the photos starting from the cursor, 
  // then see if last = results[limit-1], exists. if so, {ts: last.ts, id: last.id} is the next cursor, if not, then next cursor should be null

  if (cursor) {
    // SELECT * FROM photos WHERE (uploadedAt, id) < ($cursor.ts, $cursor.id) ORDER BY uploadedAt DESC, id DESC LIMIT limit + 1
    const results = await locals.db.select()
      .from(photos)
      .where(
        or(
          lt(photos.uploadedAt, new Date(cursor.ts)),
          and(
            eq(photos.uploadedAt, new Date(cursor.ts)),
            lt(photos.id, cursor.id)
          )
        )
      )
      .orderBy(desc(photos.uploadedAt), desc(photos.id))
      .limit(limit + 1)

    let _nextCursor: CursorType | null = null
    const lastIndex = limit - 1;
    if (limit < results.length) { // nextCursor shall be prepared
      // the last element from which cursor should be built is at index limit-1 where results.length == limit + 1
      const last = results[lastIndex]
      _nextCursor = createCursor(last.uploadedAt, last.id)
    } else { }

    const client = createR2S3Client(platform!.env);
    const items = await Promise.all(results.slice(0, limit).map(async (row) => ({
      ...row,
      uploadedAt: row.uploadedAt.getTime(),
      thumbnailUrl: row.thumbnailKey
        ?
        await createPresignedViewUrl(
          client,
          platform!.env.R2_BUCKET_NAME,
          row.thumbnailKey
        )
        : null,
    }))) satisfies PhotoListItem[];

    // return the resultset and the cursor
    return json({
      items,
      nextCursor: await encodeCursor(_nextCursor, platform!.env.CURSOR_SECRET)
    } satisfies ListPhotosResponse);

  } else {
    // no cursor provided, so take the LIMIT limits + 1 case, and see if a cursor should be made
    // SELECT * FROM photos ORDER BY uploadedAt DESC, id DESC LIMIT limit + 1
    const results = await locals.db.select()
      .from(photos)
      .orderBy(desc(photos.uploadedAt), desc(photos.id))
      .limit(limit + 1);

    let _nextCursor: CursorType | null = null;
    if (limit < results.length) {
      // nextCursor should be created 
      // the last element from which the nextCursor 
      // should be built is at index limit-1 of results 
      // where reuslts[limit] is the residual one to see
      // if the cursor should be built.
      const last = results[limit - 1];
      _nextCursor = createCursor(last.uploadedAt, last.id)
    } else { }

    const client = createR2S3Client(platform!.env);
    const items = await Promise.all(
      results.slice(0, limit).map(async (row) => ({
        ...row,
        uploadedAt: row.uploadedAt.getTime(),
        thumbnailUrl: row.thumbnailKey
          ?
          await createPresignedViewUrl(
            client,
            platform!.env.R2_BUCKET_NAME,
            row.thumbnailKey
          )
          : null,
      }))) satisfies PhotoListItem[];

    return json({
      items,
      nextCursor: await encodeCursor(_nextCursor, platform!.env.CURSOR_SECRET)
    } satisfies ListPhotosResponse);
  }
}
