import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env'), quiet: true })
config({ path: resolve(__dirname, '.env.example'), quiet: true })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 2 : 0,

  // `list` prints per-test progress with names + timing. CI default is
  // `dot` which gives no visibility into what's running. `github` adds
  // inline annotations on PRs / commits for failures.
  reporter: process.env.CI
    ? [['list', { printSteps: false }], ['github']]
    : 'list',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  webServer: {
    command: 'npx nuxt dev --port 3200',
    port: 3200,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
