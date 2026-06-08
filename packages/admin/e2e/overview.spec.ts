import { test, expect } from './setup'
import { waitForAdminReady } from './helpers'

test.describe('Festival overview', () => {
  test('shows festival name, status badge, and stats grid', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    // The overview body only renders once festival metadata arrives, which is
    // fetched async (fire-and-forget) after boot. A cold IPFS fetch can run
    // past the default 30s expect cap. Give it headroom; the remaining asserts
    // live in the same `v-else-if="metadata"` block, so they resolve instantly.
    await expect(frame.locator('[data-testid="festival-name"]')).toBeVisible({ timeout: 90_000 })
    await expect(frame.locator('[data-testid="festival-status-badge"]')).toBeVisible()
    await expect(frame.locator('[data-testid="stat-registered"]')).toBeVisible()
    await expect(frame.locator('[data-testid="stat-checked-in"]')).toBeVisible()
    await expect(frame.locator('[data-testid="stat-capacity"]')).toBeVisible()
    await expect(frame.locator('[data-testid="stat-sessions"]')).toBeVisible()
  })
})
