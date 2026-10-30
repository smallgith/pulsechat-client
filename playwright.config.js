import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { testGoogleClientId } from '../server/test/support/google-fixture.js';

export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', fullyParallel: false, workers: 1, timeout: 90000,
  expect: { timeout: 10000 }, reporter: 'list',
  use: { baseURL: 'http://localhost:5180', headless: true, actionTimeout: 15000, channel: 'msedge', trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] } },
  webServer: [
    { command: 'node --import ../server/test/support/google-provider.js ../server/index.js', url: 'http://localhost:15800/api/health', timeout: 30000,
      env: { PORT: '15800', DATA_DIR: path.resolve(`.cache/e2e-${Date.now()}`), CLIENT_URL: 'http://localhost:5180', PUBLIC_SERVER_URL: 'http://localhost:15800', GOOGLE_CLIENT_ID: testGoogleClientId, FOUNDER_PHONE: '', CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '' } },
    { command: 'npm run dev -- --host localhost --port 5180 --strictPort', url: 'http://localhost:5180', timeout: 30000,
      env: { VITE_SOCKET_URL: 'http://localhost:15800' } },
  ],
});
