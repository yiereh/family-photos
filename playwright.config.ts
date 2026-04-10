import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	webServer: {
		command: 'pnpm build && npx wrangler dev --remote --port 8787',
		port: 8787,
		reuseExistingServer: false,
		timeout: 30_000,
	},
	timeout: 60_000,
	use: {
		baseURL: 'http://localhost:8787',
	},
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
