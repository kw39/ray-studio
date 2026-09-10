const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.TEST_APP_URL || 'http://127.0.0.1:4187',
    viewport: { width: 1440, height: 1080 },
    screenshot: 'only-on-failure',
  },
  webServer: process.env.TEST_APP_URL
    ? undefined
    : {
        command: 'node serve.cjs --no-open',
        env: { PORT: '4187' },
        url: 'http://127.0.0.1:4187',
        reuseExistingServer: false,
      },
});
