import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb(event.platform!.env.DB);
	return resolve(event);
};
