import { defineConfig } from '@playwright/test';
// Run `npm run build` first. Uses the browser that is already installed (no download).
export default defineConfig({
  testDir: 'e2e/specs', timeout: 60_000, expect: { timeout: 8_000 }, fullyParallel: true, workers: 4, reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', timezoneId: 'America/Panama', locale: 'en-US', viewport: { width: 390, height: 844 },
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' }, trace: 'retain-on-failure' },
  webServer: { command: 'npx next start -p 3100', url: 'http://localhost:3100', reuseExistingServer: true, timeout: 60_000 },
});
