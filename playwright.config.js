// Сквозные тесты: Chromium на компьютере, телефоне и планшете.
// Запуск: npm run test:e2e (сервер поднимается автоматически).
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node tests/serve.js ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // Эмуляция телефона в Chromium: тач, мобильный viewport и масштаб
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Планшет в альбомной ориентации: раскладка как на компьютере, но управление пальцем
    { name: 'tablet', use: { ...devices['Galaxy Tab S4 landscape'] } },
  ],
});
