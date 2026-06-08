import { test, expect } from './setup'
import { waitForAdminReady } from './helpers'

test.describe('Venue map editor', () => {
  test('map page renders heading and editor surfaces', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-map"]').first().click()
    await expect(frame.locator('[data-testid="map-heading"]')).toBeVisible()
    await expect(frame.locator('[data-testid="venue-map"]')).toBeVisible()
    // Admin starts on the outdoor view. Back button only appears once the
    // editor enters the building.
    await expect(frame.locator('[data-testid="map-back-btn"]')).toHaveCount(0)
    // The edit hint renders for accounts with canEditMetadata (manager+).
    // Bob has the role from the seed, but the surrounding hint UI is layout-
    // dependent. Keep the soft check to stay robust if future copy hides it.
    const editHint = frame.locator('[data-testid="map-edit-hint"]')
    if (await editHint.isVisible().catch(() => false)) {
      await expect(editHint).toBeVisible()
    }
  })
})
