import { test, expect } from './setup'
import { waitForAttendeeReady, navLink } from './helpers'

test.describe('Tab navigation', () => {
  test('home → map → program → home', async ({ testHost }) => {
    const frame = await waitForAttendeeReady(testHost)

    await (await navLink(frame, 'map')).click()
    await expect(frame.locator('[data-testid="map-heading"]')).toBeVisible()

    await (await navLink(frame, 'program')).click()
    await expect(frame.locator('[data-testid="program-tab-program"]')).toBeVisible()

    await (await navLink(frame, 'home')).click()
    await expect(frame.locator('[data-testid="home-passport"]')).toBeVisible()
  })
})
