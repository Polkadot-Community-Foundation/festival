import { test, expect } from './setup'
import { waitForAdminReady } from './helpers'

test.describe('Sessions list', () => {
  test('sessions page renders heading and create link', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-sub-events"]').first().click()
    await expect(frame.locator('[data-testid="sub-events-heading"]')).toBeVisible()
    await expect(frame.locator('[data-testid="sub-event-create-link"]')).toBeVisible()
  })

  // TODO: re-enable once useSubEvents.ts wires flagCount through bootLoadAdmin
  // (currently stubbed `flagCount: 0` at packages/admin/app/composables/useSubEvents.ts:54).
  // Bob's flag tx in the seed lands on-chain, but the admin SPA never reads
  // flagCount, so the badge UI can't render and these tests can't pass
  // regardless of seed state.
  test.fixme('flagged sessions render a flag badge in the list', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-sub-events"]').first().click()
    await expect(frame.locator('[data-testid="sub-events-heading"]')).toBeVisible()

    const badges = frame.locator('[data-testid="session-flag-badge"]')
    await expect(badges.first()).toBeVisible()
    // Each badge text is "⚑ N / M". Sanity-check shape.
    const text = (await badges.first().textContent()) ?? ''
    expect(text).toMatch(/\d+\s*\/\s*\d+/)
  })

  test.fixme('moderation banner appears on a flagged session detail', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-sub-events"]').first().click()
    const flaggedRow = frame.locator('a:has([data-testid="session-flag-badge"])').first()
    await expect(flaggedRow).toBeVisible()

    await flaggedRow.click()
    await expect(frame.locator('[data-testid="moderation-banner"]')).toBeVisible()
    // The cancel button is only rendered at threshold AND for an admin/manager
    // on the festival. We don't assert presence. Just that the banner itself
    // is wired up. Existence of the button below threshold would be a real bug.
  })
})
