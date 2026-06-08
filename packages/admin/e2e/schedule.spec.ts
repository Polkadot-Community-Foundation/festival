import { test, expect } from './setup'
import { waitForAdminReady } from './helpers'

test.describe('Schedule editor', () => {
  test('schedule page renders heading', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-schedule"]').first().click()
    await expect(frame.locator('[data-testid="schedule-heading"]')).toBeVisible()
    await expect(frame.locator('[data-testid="schedule-add-btn"]')).toBeVisible()
  })
})
