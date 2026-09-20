import { defineConfig, devices } from '@playwright/test';

const apiPort = Number(process.env.E2E_API_PORT ?? 3001);
const webPort = Number(process.env.E2E_WEB_PORT ?? 5176);
const adminPort = Number(process.env.E2E_ADMIN_PORT ?? 5177);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/e2e-server.cjs api',
      url: `http://127.0.0.1:${apiPort}/api/v1/health`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node scripts/e2e-server.cjs web',
      url: `http://127.0.0.1:${webPort}`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node scripts/e2e-server.cjs admin',
      url: `http://127.0.0.1:${adminPort}`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 跨浏览器按需开启：默认只跑 chromium（快），需要时用
    //   E2E_BROWSERS=firefox,webkit npx playwright test ...
    // 前提是先执行 npx playwright install firefox webkit。
    ...(process.env.E2E_BROWSERS ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name === 'firefox' || name === 'webkit')
      .map((name) => ({
        name,
        use: { ...devices[name === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'] },
      })),
  ],
});
