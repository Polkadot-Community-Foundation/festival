import { test, expect } from './setup'
import { waitForAttendeeReady } from './helpers'

/**
 * Coverage for the 4-step session-create flow up to the Session Overview screen.
 *
 * Walks step 1 (date + time + name) → step 2 (location intro), then back to
 * confirm form state persists. Stops short of the location/badge submission:
 * the picker and badge editor sit on MapLibre GL canvases with no stable
 * pixel-coordinate handles for Playwright. Full step 3→4 coverage needs test
 * IDs inside SessionLocationPicker's canvas first.
 */
test.describe('Session create — 4-step flow', () => {
  test('steps 1 → 2 navigation preserves details and reveals location intro', async ({ testHost }) => {
    const frame = await waitForAttendeeReady(testHost)

    // SPA-navigate so create.vue's `isCheckedIn` watch doesn't race a fresh
    // page load and bounce us to / before the chain settles.
    await frame.locator('[data-testid="nav-item-program"], [data-testid="tab-program"]').first().click()
    await frame.locator('a[href*="/sessions/host"]').first().click()
    await frame.locator('a[href*="/sessions/create"]').first().click()

    // ── Step 1: fill date / time / name ──
    await frame.locator('[data-testid="session-date-add"]').click()
    await frame.locator('[data-testid^="session-date-option-"]').first().click()

    await frame.locator('[data-testid="session-time-from-pill"]').click()
    await frame.locator('[data-testid^="session-time-from-hour-"]').first().click()
    await frame.locator('[data-testid^="session-time-from-minute-"]').first().click()
    await frame.locator('[data-testid^="session-time-to-hour-"]').first().click()
    await frame.locator('[data-testid^="session-time-to-minute-"]').first().click()

    const nameInput = frame.locator('[data-testid="session-name-input"]')
    await nameInput.fill('Overview flow test')

    // Step 1's Next becomes enabled once date+time+name are set.
    const step1Next = frame.locator('[data-testid="create-step1-next"]')
    await expect(step1Next).toBeEnabled()

    // ── Step 1 → Step 2 ──
    await step1Next.click()

    // Step 2 renders the SessionLocationIntro hero copy and the "Choose
    // Location" CTA in the bottom action area.
    await expect(frame.getByText('drop a pin anywhere', { exact: false })).toBeVisible()
    await expect(frame.getByRole('button', { name: 'Choose Location' })).toBeVisible()

    // ── Back arrow → Step 1, state preserved ──
    // Header back arrow: the only navigation button in the header on steps 2+.
    await frame.locator('header, [class*="px-4 pt-4"]').first().locator('button').first().click()

    // Step 1 inputs still hold the values we set.
    await expect(nameInput).toHaveValue('Overview flow test')
    // From/To pills should be in "filled" state (have the chosen time below
    // their small "From"/"To" caption).
    await expect(frame.locator('[data-testid="session-time-from-pill"]')).toContainText(':')
    await expect(frame.locator('[data-testid="session-time-to-pill"]')).toContainText(':')
  })
})
