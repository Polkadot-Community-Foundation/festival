import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCid, cidToBytes32, bytes32ToCid } from '../metadata/cid'

/**
 * Golden CIDs captured against the reference implementation. They guard against
 * regressions in our blake2b/multiformats path. A typo here would silently
 * corrupt every metadata write.
 *
 * Recompute and update only when intentionally changing the hashing scheme.
 */

test('computeCid: "hello bulletin" → known CID', async () => {
  const data = new TextEncoder().encode('hello bulletin')
  assert.equal(
    (await computeCid(data)).toString(),
    'bafk2bzaceb4gdfu5bcqrnez5nqvd4fejuiidegzx5xutpv6yuosjgufm4b7tk',
  )
})

test('computeCid: byte array [1,2,3,4] → known CID', async () => {
  const data = new Uint8Array([1, 2, 3, 4])
  assert.equal(
    (await computeCid(data)).toString(),
    'bafk2bzaceaufc7sm35wja6mmdkmdwa3spstxipbbuoeam4sctth4lpiv5jpxe',
  )
})

test('cidToBytes32: digest matches known value', async () => {
  const data = new TextEncoder().encode('hello bulletin')
  assert.equal(
    cidToBytes32(await computeCid(data)),
    '0x7861969d08a116933d6c2a3e1489a210321b37ede937d7d8a3a49350ace07f35',
  )
})

test('CID computation is stable across calls', async () => {
  const data = new Uint8Array([42, 9, 7])
  assert.equal((await computeCid(data)).toString(), (await computeCid(data)).toString())
})

test('bytes32 round-trip preserves CID', async () => {
  const data = new TextEncoder().encode('round-trip fixture')
  const cid = await computeCid(data)
  const bytes32 = cidToBytes32(cid)
  const restored = bytes32ToCid(bytes32)
  assert.equal(cid.toString(), restored.toString())
})
