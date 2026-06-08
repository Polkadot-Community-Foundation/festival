import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkTooling, summarize, type CheckResult } from './preflight'

test('checkTooling: includes core tools and node passes on this runtime', () => {
  const results = checkTooling()
  const ids = results.map((r) => r.id)
  for (const id of ['node', 'npm', 'forge', 'git', 'gh']) {
    assert.ok(ids.includes(id), `missing check: ${id}`)
  }
  const node = results.find((r) => r.id === 'node')!
  // Tests run under the project's Node (≥ 20.19), so this must pass.
  assert.equal(node.status, 'ok')
})

test('checkTooling: gh is advisory (never blocks)', () => {
  const gh = checkTooling().find((r) => r.id === 'gh')!
  assert.ok(gh.status === 'ok' || gh.status === 'warn')
})

test('summarize: counts by severity and flags blockers', () => {
  const sample: CheckResult[] = [
    { id: 'a', label: 'a', status: 'ok' },
    { id: 'b', label: 'b', status: 'warn' },
    { id: 'c', label: 'c', status: 'warn' },
    { id: 'd', label: 'd', status: 'block' },
  ]
  const s = summarize(sample)
  assert.deepEqual({ ok: s.ok, warn: s.warn, block: s.block, blocked: s.blocked }, {
    ok: 1,
    warn: 2,
    block: 1,
    blocked: true,
  })
})

test('summarize: no blockers when all ok/warn', () => {
  const s = summarize([
    { id: 'a', label: 'a', status: 'ok' },
    { id: 'b', label: 'b', status: 'warn' },
  ])
  assert.equal(s.blocked, false)
})
