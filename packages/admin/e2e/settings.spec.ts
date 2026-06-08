import { test, expect } from './setup'
import { waitForAdminReady } from './helpers'

test.describe('Settings', () => {
  test('settings page renders heading', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-settings"]').first().click()
    await expect(frame.locator('[data-testid="settings-heading"]')).toBeVisible()
  })

  test('capacity input and update button are visible for admins', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-settings"]').first().click()
    await expect(frame.locator('[data-testid="settings-heading"]')).toBeVisible()

    await expect(frame.locator('[data-testid="capacity-input"]')).toBeVisible()
    await expect(frame.locator('[data-testid="capacity-update-btn"]')).toBeVisible()
  })

  test('cancel-festival confirmation dialog opens and closes', async ({ testHost }) => {
    const frame = await waitForAdminReady(testHost)

    await frame.locator('[data-testid="nav-item-settings"]').first().click()
    await expect(frame.locator('[data-testid="settings-heading"]')).toBeVisible()

    const cancelBtn = frame.locator('[data-testid="cancel-festival-btn"]')
    await expect(cancelBtn).toBeVisible()
    if (await cancelBtn.isDisabled()) {
      // Festival already cancelled on this contract instance. Nothing to confirm.
      return
    }

    await cancelBtn.click()
    await expect(frame.locator('[data-testid="cancel-confirm-btn"]')).toBeVisible()
    await expect(frame.locator('[data-testid="cancel-keep-btn"]')).toBeVisible()

    await frame.locator('[data-testid="cancel-keep-btn"]').click()
    await expect(frame.locator('[data-testid="cancel-confirm-btn"]')).not.toBeVisible()
  })
})
