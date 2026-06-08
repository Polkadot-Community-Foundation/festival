import { test, expect } from './setup'
import { waitForAdminReady } from './helpers'

test.describe('Check-in flow', () => {
  test('idle state shows scan account button', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-checkin"]').first().click()
    await expect(frame.locator('[data-testid="checkin-heading"]')).toBeVisible()
    await expect(frame.locator('[data-testid="checkin-idle"]')).toBeVisible()
    await expect(frame.locator('[data-testid="checkin-scan-account-btn"]')).toBeVisible()
  })

  test('manual entry section expands on toggle', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-checkin"]').first().click()
    await expect(frame.locator('[data-testid="checkin-heading"]')).toBeVisible()

    await frame.locator('[data-testid="manual-entry-toggle"]').click()
    await expect(frame.locator('[data-testid="manual-address-input"]')).toBeVisible()
    await expect(frame.locator('[data-testid="manual-checkin-btn"]')).toBeVisible()
  })
})
