import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveFestivalColor, FESTIVAL_COLORS } from '../utils/festivalColor'

test('deriveFestivalColor: stable across calls', () => {
  const addr = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
  assert.equal(deriveFestivalColor(addr), deriveFestivalColor(addr))
})

test('deriveFestivalColor: returns a palette color', () => {
  const samples = [
    '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    '5GmWVVeF8PPAmXShtTas8cvxD3fu3Am64Kgg3nGkH7SXsRxP',
    '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    '',
  ]
  for (const addr of samples) {
    assert.ok(
      (FESTIVAL_COLORS as readonly string[]).includes(deriveFestivalColor(addr)),
      `unexpected color for "${addr}"`,
    )
  }
})

test('deriveFestivalColor: full palette reachable across many addresses', () => {
  const seen = new Set<string>()
  // Vary one character at a time to spread DJB2 hash output across the palette.
  const base = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQ'
  for (let i = 0; i < 256; i++) {
    seen.add(deriveFestivalColor(base + i.toString(36)))
  }
  assert.equal(seen.size, FESTIVAL_COLORS.length, 'every palette color should be reachable')
})

test('deriveFestivalColor: different addresses generally pick different colors', () => {
  const a = deriveFestivalColor('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')
  const b = deriveFestivalColor('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty')
  // Not strictly required by the design, but DJB2 should give different output
  // for two unrelated SS58 strings. If this ever flakes, swap the second input.
  assert.notEqual(a, b)
})
