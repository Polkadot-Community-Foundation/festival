import { hostApi } from '@novasamatech/host-api-wrapper'
import { isInHost } from './detect'

/**
 * Open an external URL. Inside a host, routes through `hostApi.navigateTo`
 * (the sandbox blocks `window.open`); the host prompts for `OpenUrl`
 * permission on first use. In standalone mode, opens a new tab.
 */
export async function openUrl(url: string): Promise<boolean> {
  if (!isInHost()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  }

  const result = await hostApi.navigateTo({ tag: 'v1', value: url })
  return result.match(
    () => true,
    (err) => {
      console.warn('[openUrl] navigateTo failed', err)
      return false
    },
  )
}
