import { test, expect } from './setup'
import { waitForAdminReady } from './helpers'

test.describe('Review & Publish Changes', () => {
  test('changes page renders heading after a draft metadata edit', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    // If the SPA shows the "Metadata is being indexed" placeholder (the IPFS
    // gateway hasn't mirrored this run's CID yet), click Retry until the
    // overview renders. Up to 6 × 5s = 30s grace for gateway propagation.
    const indexingRetry = frame.getByRole('button', { name: 'Retry' })
    for (let i = 0; i < 6; i++) {
      if (await indexingRetry.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await indexingRetry.click()
        await new Promise((r) => setTimeout(r, 5_000))
      } else {
        break
      }
    }

    // The unpublished-changes link is per-tab Pinia state, not chain state, so
    // we dirty the metadata draft to make it appear. The Details card's Edit
    // toggle exposes inputs that trip the dirty watcher in useFestivalContext.
    await frame.getByRole('button', { name: 'Edit' }).first().click({ timeout: 30_000 })
    await frame
      .getByPlaceholder('Web3 Summit 2026')
      .fill('E2E Test Festival — draft')
    // Close the edit panel so the changes link renders in the layout chrome.
    await frame.getByRole('button', { name: 'Done' }).first().click()

    const changesLink = frame.locator('a[href*="/changes"]').first()
    await expect(changesLink).toBeVisible({ timeout: 10_000 })

    await changesLink.click()
    await expect(frame.locator('[data-testid="changes-heading"]')).toBeVisible()
  })
})
