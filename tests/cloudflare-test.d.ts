/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare namespace Cloudflare {
	interface Env {
		DB: D1Database;
		BUCKET: R2Bucket;
		KV: KVNamespace;
		TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
	}
}
