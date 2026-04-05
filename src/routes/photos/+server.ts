import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { photos } from '$lib/server/db/schema'
import { desc } from "drizzle-orm";

export const GET: RequestHandler = async ({ request, locals }) => {
  const results = await locals.db.select().from(photos).orderBy(desc(photos.uploadedAt));
  return json(results);
}
