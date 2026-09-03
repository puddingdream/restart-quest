import { defineConfig } from '@playwright/test'
import { env } from 'node:process'

const baseURL = env.E2E_BASE_URL ?? 'http://localhost:8080'
const integrationHeadSha = env.INTEGRATION_HEAD_SHA ?? ''

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  forbidOnly: Boolean(env.CI),
  outputDir: 'dist/playwright/test-results',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'dist/playwright/report' }],
  ],
  metadata: {
    integrationHeadSha,
  },
  use: {
    baseURL,
    browserName: 'chromium',
    locale: 'ko-KR',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'integration-chromium',
      grepInvert: /@viewport/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'viewport-360x800',
      grep: /@viewport/,
      use: { viewport: { width: 360, height: 800 } },
    },
    {
      name: 'viewport-768x1024',
      grep: /@viewport/,
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'viewport-1440x900',
      grep: /@viewport/,
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
})
