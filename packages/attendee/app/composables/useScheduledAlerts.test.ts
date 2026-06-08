import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { toHostDeeplink } from './useScheduledAlerts'

// `toHostDeeplink` reads `window.location.origin` at call time, so we stub it
// per case. The host re-opens the product on notification tap by resolving the
// product from the deeplink's HOST, so a relative `/#/...` (no host) must be
// origin-qualified; without a usable origin the route is left untouched.
const realWindow = (globalThis as { window?: unknown }).window

function setOrigin(origin: string | undefined) {
  if (origin === undefined) {
    delete (globalThis as { window?: unknown }).window
  } else {
    ;(globalThis as { window?: unknown }).window = { location: { origin } }
  }
}

afterEach(() => {
  if (realWindow === undefined) delete (globalThis as { window?: unknown }).window
  else (globalThis as { window?: unknown }).window = realWindow
})

describe('toHostDeeplink', () => {
  it('host-qualifies a relative route with the in-host origin', () => {
    setOrigin('polkadot://web3summit.dot')
    assert.equal(
      toHostDeeplink('/#/program/123'),
      'polkadot://web3summit.dot/#/program/123',
    )
    assert.equal(
      toHostDeeplink('/#/sessions/0xabc'),
      'polkadot://web3summit.dot/#/sessions/0xabc',
    )
  })

  it('uses whatever origin the current host exposes (e.g. the web gateway)', () => {
    setOrigin('https://web3summit.dot.li')
    assert.equal(
      toHostDeeplink('/#/program/9'),
      'https://web3summit.dot.li/#/program/9',
    )
  })

  it('leaves the route unchanged when there is no window (SSR)', () => {
    setOrigin(undefined)
    assert.equal(toHostDeeplink('/#/program/123'), '/#/program/123')
  })

  it('leaves the route unchanged for an opaque or empty origin', () => {
    setOrigin('null')
    assert.equal(toHostDeeplink('/#/program/123'), '/#/program/123')
    setOrigin('')
    assert.equal(toHostDeeplink('/#/program/123'), '/#/program/123')
  })

  it('does not double-qualify an already-absolute deeplink', () => {
    setOrigin('polkadot://web3summit.dot')
    const absolute = 'polkadot://web3summit.dot/#/program/123'
    assert.equal(toHostDeeplink(absolute), absolute)
  })
})
