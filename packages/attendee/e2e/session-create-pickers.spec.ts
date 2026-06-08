import type { Page } from '@playwright/test'
import { test, expect } from './setup'
import { waitForAttendeeReady } from './helpers'

/**
 * Coverage for the session-create date/time pickers (15-min slots, two-stage
 * hour → minute flow).
 *
 * FrameLocator has no goto(), but the underlying Frame does. Driving navigation
 * through Playwright (CDP) sidesteps the cross-origin block on any JS-level
 * access to the iframe's contentWindow.location.
 */
async function gotoInIframe(page: Page, path: string) {
  const frame = page.frames().find((f) => f.url().startsWith('http://localhost:3200'))
  if (!frame) throw new Error('product iframe not found')
  await frame.goto(new URL(path, frame.url()).toString())
}

test.describe('Session create — pickers', () => {
  test('date picker collapse/expand and time-grid behavior', async ({ testHost }) => {
    const frame = await waitForAttendeeReady(testHost)

    // Navigate via SPA routing (NuxtLink clicks), not `frame.goto`, so Vue
    // state including the chain-loaded `isCheckedIn` survives. A direct goto
    // reloads the iframe; create.vue's immediate watch fires at
    // isCheckedIn=false and redirects to / before the chain read settles.
    // Hash mode (nuxt.config.ts) renders hrefs like `#/sessions/host`, so match with *=.
    await frame.locator('[data-testid="nav-item-program"], [data-testid="tab-program"]').first().click()
    await frame.locator('a[href*="/sessions/host"]').first().click()
    await frame.locator('a[href*="/sessions/create"]').first().click()

    const datePicker = frame.locator('[data-testid="session-date-picker"]')
    await expect(datePicker).toBeVisible({ timeout: 10_000 })

    const addBtn = frame.locator('[data-testid="session-date-add"]')
    await expect(addBtn).toBeVisible()
    await addBtn.click()

    const dayOptions = frame.locator('[data-testid^="session-date-option-"]')
    await expect(dayOptions.first()).toBeVisible()
    expect(await dayOptions.count()).toBeGreaterThan(0)

    await dayOptions.first().click()
    await expect(frame.locator('[data-testid="session-date-pill"]')).toBeVisible()

    const fromPill = frame.locator('[data-testid="session-time-from-pill"]')
    const toPill = frame.locator('[data-testid="session-time-to-pill"]')
    await expect(fromPill).toBeEnabled()
    await expect(toPill).toBeDisabled()

    // ── From. Hour grid ──
    await fromPill.click()
    await expect(frame.locator('[data-testid="session-time-grid"]')).toBeVisible()

    const fromHourBtns = frame.locator('[data-testid^="session-time-from-hour-"]')
    const fromHourCount = await fromHourBtns.count()
    expect(fromHourCount).toBeGreaterThan(0)

    // Every shown start hour must lie in 9..21 (a 15-min session must fit before 22:00).
    for (let i = 0; i < fromHourCount; i++) {
      const txt = (await fromHourBtns.nth(i).textContent())?.trim() ?? ''
      const hour = parseInt(txt.split(':')[0]!, 10)
      expect(hour).toBeGreaterThanOrEqual(9)
      expect(hour).toBeLessThanOrEqual(21)
    }

    // Pick the first hour bucket → minute grid appears, with Back as first cell.
    await fromHourBtns.first().click()
    await expect(frame.locator('[data-testid="session-time-back"]')).toBeVisible()

    const fromMinuteBtns = frame.locator('[data-testid^="session-time-from-minute-"]')
    const fromMinuteCount = await fromMinuteBtns.count()
    expect(fromMinuteCount).toBeGreaterThanOrEqual(1)
    expect(fromMinuteCount).toBeLessThanOrEqual(4)

    // Every minute label is :00, :15, :30, or :45.
    for (let i = 0; i < fromMinuteCount; i++) {
      const txt = (await fromMinuteBtns.nth(i).textContent())?.trim() ?? ''
      const min = parseInt(txt.split(':')[1]!, 10)
      expect([0, 15, 30, 45]).toContain(min)
    }

    // Pick the first minute → picker auto-advances to To. Hour.
    await fromMinuteBtns.first().click()
    await expect(frame.locator('[data-testid="session-time-back"]')).toBeHidden()

    const toHourBtns = frame.locator('[data-testid^="session-time-to-hour-"]')
    const toHourCount = await toHourBtns.count()
    expect(toHourCount).toBeGreaterThanOrEqual(1)

    // Pick the first reachable to-hour → minute grid + Back.
    await toHourBtns.first().click()
    await expect(frame.locator('[data-testid="session-time-back"]')).toBeVisible()

    const toMinuteBtns = frame.locator('[data-testid^="session-time-to-minute-"]')
    const toMinuteCount = await toMinuteBtns.count()
    expect(toMinuteCount).toBeGreaterThanOrEqual(1)
    expect(toMinuteCount).toBeLessThanOrEqual(4)

    // Pick the first to-minute → grid collapses, both pills filled, duration footer shown.
    await toMinuteBtns.first().click()
    await expect(frame.locator('[data-testid="session-time-back"]')).toBeHidden()
    await expect(frame.locator('[data-testid="session-time-grid"]')).toBeHidden()
    await expect(frame.locator('[data-testid="session-time-duration"]')).toContainText(
      'Your Session Duration',
    )

    // Description counter updates as the user types.
    const desc = frame.locator('[data-testid="session-description-input"]')
    const counter = frame.locator('[data-testid="session-description-counter"]')
    await desc.fill('hello')
    await expect(counter).toHaveText('5/1200')
  })
})
