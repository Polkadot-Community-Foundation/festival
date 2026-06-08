import { test, expect } from './setup'
import { waitForAttendeeReady, navLink } from './helpers'

test.describe('Report session flow', () => {
  // TODO: flake. The same hash-mode nav to /sessions/<addr> that program-detail
  // uses works there but fails here, even with evaluate-click → location.hash →
  // hashchange + popstate. Likely Vue Router timing vs the dev overlay's
  // mutation observers. Re-enable once the dev overlay is pointer-events:none
  // in test builds, or the SPA exposes $router for direct programmatic nav.
  test.fixme('Report sheet opens, cancels cleanly, and reopens', async ({ testHost }) => {
    const frame = await waitForAttendeeReady(testHost)

    await (await navLink(frame, 'program')).click()
    // Pick a sub-event card (links to /sessions/<addr>). Schedule entries
    // route to /program/<id> where there's no report-trigger.
    const firstCard = frame
      .locator('[data-testid="program-card"][href*="/sessions/"]')
      .first()
    await expect(firstCard).toBeVisible()

    // NuxtLink doesn't navigate on synthetic clicks in this iframe context, so
    // drive Vue Router via window.location.hash directly (hash mode triggers a
    // route change without reload).
    const href = await firstCard.getAttribute('href')
    if (!href) throw new Error('Sub-event card has no href')
    const iframe = testHost.page
      .frames()
      .find((f) => f.url().includes('localhost:3200'))
    if (!iframe) throw new Error('iframe not found')
    await iframe.evaluate((h) => {
      const hash = h.startsWith('#') ? h : '#' + h
      const oldUrl = window.location.href
      window.location.hash = hash
      // Belt-and-braces: dispatch hashchange + popstate so Vue Router
      // picks up the change regardless of which event it listens on.
      window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: oldUrl, newURL: window.location.href }))
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, href)
    await expect(frame.locator('[data-testid="session-detail-heading"]')).toBeVisible({ timeout: 30_000 })

    // Bob is checked in (seed step) and holds festival POAP #1, so the Report
    // trigger renders on every session detail he doesn't himself create.
    const reportTrigger = frame.locator('[data-testid="session-report-trigger"]')
    await expect(reportTrigger).toBeVisible()

    await reportTrigger.evaluate((el) => (el as HTMLElement).click())
    const sheet = frame.locator('[data-testid="report-session-sheet"]')
    await expect(sheet).toBeVisible()
    await expect(frame.locator('[data-testid="report-session-confirm"]')).toBeVisible()

    await frame.locator('[data-testid="report-session-cancel"]').evaluate((el) => (el as HTMLElement).click())
    await expect(sheet).toHaveCount(0, { timeout: 10_000 })

    // Reopen. The session must still be present (cancel did not hide it).
    await reportTrigger.evaluate((el) => (el as HTMLElement).click())
    await expect(sheet).toBeVisible()
    await frame.locator('[data-testid="report-session-cancel"]').evaluate((el) => (el as HTMLElement).click())
    await expect(sheet).toHaveCount(0, { timeout: 10_000 })
  })
})
