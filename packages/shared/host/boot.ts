import { detectHostEnvironment, isInHost } from './detect'
import type { HostEnvironment } from './detect'

/**
 * Boot gate for the festival app.
 * Returns the detected host environment. If standalone, the caller
 * should show a "Connect via Polkadot Host" blocker.
 */
export function bootApp(): { environment: HostEnvironment; allowed: boolean } {
  const environment = detectHostEnvironment()
  return {
    environment,
    allowed: isInHost(),
  }
}
