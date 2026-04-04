import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
	const migrationsPath = path.join(__dirname, 'migrations');
	const migrations = await readD1Migrations(migrationsPath);

	return {
		plugins: [
			cloudflareTest({
				wrangler: { configPath: './wrangler.test.jsonc' },
				miniflare: {
					d1Databases: ['DB'],
					r2Buckets: ['BUCKET'],
					kvNamespaces: ['KV'],
					bindings: { TEST_MIGRATIONS: migrations }
				}
			})
		]
	};
});
