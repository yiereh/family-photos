import { env, applyD1Migrations } from 'cloudflare:test';

export async function applyMigrations() {
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
}
