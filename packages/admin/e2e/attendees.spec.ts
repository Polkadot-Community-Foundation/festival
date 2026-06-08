import { test, expect } from './setup'
import { waitForAdminReady } from './helpers'

test.describe('Attendees', () => {
  test('attendees page renders heading and search input', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-attendees"]').first().click()
    await expect(frame.locator('[data-testid="attendees-heading"]')).toBeVisible()
    await expect(frame.locator('[data-testid="attendees-search"]')).toBeVisible()
  })
})
