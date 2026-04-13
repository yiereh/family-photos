import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { photos } from '$lib/server/db/schema'
import { createCursor, decodeCursor, encodeCursor, parseLimit, type CursorType } from "$lib/server/pagination";
import { error } from "@sveltejs/kit";
import { and, asc, gt, or } from "drizzle-orm";
import { eq } from "drizzle-orm";

const DEFAULT_LIMIT = 20

export const GET: RequestHandler = async ({ url, locals, platform }) => {

  const cursor = await decodeCursor(url.searchParams.get("cursor"), platform!.env.CURSOR_SECRET);
  const limit = parseLimit(url.searchParams.get("limit")) ?? DEFAULT_LIMIT;
  if (limit < 0) {
    error(400, "bad request")
  }

  // if a cursor is given, query with (uploadedAt, id) > ($ts, $id) <=> (updateAt > $ts) OR (updateAt = $ts AND id > $id) ORDER BY uploadedAt ASC LIMIT limit + 1 to fetch all the photos starting from the cursor, 
  // then see if last = reultts[limit], then limit + 1 th element exists, and if so, {ts: last.ts, id: last.id} is the next cursor, if not, then next cursor should be null

  if (cursor) {
    // SELECT * FROM photos WHERE ($cursor.ts, $cursor.id) < (uploadedAt, id) ORDER BY uploadedAt ASC, id ASC LIMIT limit + 1
    const results = await locals.db.select()
      .from(photos)
      .where(
        or(
          gt(photos.uploadedAt, new Date(cursor.ts)),
          and(
            eq(photos.uploadedAt, new Date(cursor.ts)),
            gt(photos.id, cursor.id)
          )
        )
      )
      .orderBy(asc(photos.uploadedAt), asc(photos.id))
      .limit(limit + 1)

    let _nextCursor: CursorType | null = null
    if (limit < results.length) { // nextCursor shall be prepared
      const last = results[limit - 1]
      _nextCursor = createCursor(last.uploadedAt, last.id)
    } else { }

    // return the resultset and the cursor
    return json({
      items: results.slice(0, limit),
      nextCursor: await encodeCursor(_nextCursor, platform!.env.CURSOR_SECRET)
    });

  } else {
    // no cursor provided, so take the LIMIT limits + 1 case, and see if a cursor should be made
    // SELECT * FROM photos ORDER BY uploadedAt ASC, id ASC LIMIT limit + 1
    const results = await locals.db.select()
      .from(photos)
      .orderBy(asc(photos.uploadedAt), asc(photos.id))
      .limit(limit + 1);

    let _nextCursor: CursorType | null = null;
    if (limit < results.length) {
      // nextCursor should be created 
      const last = results[limit - 1];
      _nextCursor = createCursor(last.uploadedAt, last.id)
    } else { }

    return json({
      items: results.slice(0, limit),
      nextCursor: await encodeCursor(_nextCursor, platform!.env.CURSOR_SECRET)
    })
  }
}
