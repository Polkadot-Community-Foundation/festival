import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDomainTokenId, meetsRequirement, popStatusName, PoP } from './dotns-check'

// Frozen golden values. Guard against changes to the tokenId formula or DOT_NODE.
const GOLDEN: Record<string, bigint> = {
  web3summit: 66446286750642861657443846495760282221130635805414159553865669924937078485298n,
  myfest: 64726111225993451134166226815337122204934516981588229745297801876539485759182n,
  test: 34237853353352181898665039912662869071251742932162035141339004738627487150327n,
  a: 108946580615553351106975006214532358260234419911818595647232315060081820132806n,
}

test('computeDomainTokenId: matches frozen golden values', () => {
  for (const [label, expected] of Object.entries(GOLDEN)) {
    assert.equal(computeDomainTokenId(label), expected, `tokenId mismatch for "${label}"`)
  }
})

test('computeDomainTokenId: stable + distinct per label', () => {
  assert.equal(computeDomainTokenId('myfest'), computeDomainTokenId('myfest'))
  assert.notEqual(computeDomainTokenId('myfest'), computeDomainTokenId('myfest2'))
})

test('meetsRequirement: NoStatus label is open to everyone', () => {
  for (const u of [PoP.NoStatus, PoP.Lite, PoP.Full]) {
    assert.equal(meetsRequirement(PoP.NoStatus, u), true)
  }
})

test('meetsRequirement: Lite label needs Lite or Full', () => {
  assert.equal(meetsRequirement(PoP.Lite, PoP.NoStatus), false)
  assert.equal(meetsRequirement(PoP.Lite, PoP.Lite), true)
  assert.equal(meetsRequirement(PoP.Lite, PoP.Full), true)
})

test('meetsRequirement: Full label needs Full', () => {
  assert.equal(meetsRequirement(PoP.Full, PoP.NoStatus), false)
  assert.equal(meetsRequirement(PoP.Full, PoP.Lite), false)
  assert.equal(meetsRequirement(PoP.Full, PoP.Full), true)
})

test('meetsRequirement: Reserved is never self-registerable', () => {
  for (const u of [PoP.NoStatus, PoP.Lite, PoP.Full, PoP.Reserved]) {
    assert.equal(meetsRequirement(PoP.Reserved, u), false)
  }
})

test('popStatusName: maps known levels', () => {
  assert.equal(popStatusName(PoP.NoStatus), 'NoStatus')
  assert.equal(popStatusName(PoP.Lite), 'Lite')
  assert.equal(popStatusName(PoP.Full), 'Full')
  assert.equal(popStatusName(PoP.Reserved), 'Reserved')
  assert.equal(popStatusName(99), 'Unknown(99)')
})
