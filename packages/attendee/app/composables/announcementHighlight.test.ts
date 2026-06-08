import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  computeUnreadCount,
  snapshotUnreadCids,
  newCidsSince,
} from './announcementHighlight'

describe('computeUnreadCount', () => {
  it('returns 0 for an empty channel', () => {
    assert.equal(computeUnreadCount([], null), 0)
    assert.equal(computeUnreadCount([], 'a'), 0)
  })

  it('treats every announcement as unread when lastReadCid is null', () => {
    assert.equal(computeUnreadCount(['a', 'b', 'c'], null), 3)
  })

  it('counts only announcements strictly after lastReadCid', () => {
    assert.equal(computeUnreadCount(['a', 'b', 'c', 'd'], 'b'), 2)
    assert.equal(computeUnreadCount(['a', 'b', 'c', 'd'], 'd'), 0)
    assert.equal(computeUnreadCount(['a', 'b', 'c', 'd'], 'a'), 3)
  })

  it('conservatively treats whole list as unread when lastReadCid is unknown', () => {
    // Simulates a lastRead CID that fell off the soft cap or was redacted.
    assert.equal(computeUnreadCount(['a', 'b', 'c'], 'z'), 3)
  })
})

describe('snapshotUnreadCids', () => {
  it('returns an empty array when the channel is empty', () => {
    assert.deepEqual(snapshotUnreadCids([], null), [])
    assert.deepEqual(snapshotUnreadCids([], 'a'), [])
  })

  it('returns every CID when no last-read marker exists', () => {
    assert.deepEqual(snapshotUnreadCids(['a', 'b', 'c'], null), ['a', 'b', 'c'])
  })

  it('returns the slice strictly after lastReadCid', () => {
    assert.deepEqual(snapshotUnreadCids(['a', 'b', 'c', 'd'], 'b'), ['c', 'd'])
    assert.deepEqual(snapshotUnreadCids(['a', 'b', 'c', 'd'], 'd'), [])
  })

  it('falls back to the whole list when lastReadCid is no longer present', () => {
    assert.deepEqual(snapshotUnreadCids(['a', 'b', 'c'], 'z'), ['a', 'b', 'c'])
  })

  it('does not return the same array reference (callers can mutate freely)', () => {
    const src = ['a', 'b', 'c']
    const out = snapshotUnreadCids(src, null)
    assert.notEqual(out, src)
  })
})

describe('newCidsSince', () => {
  it('returns the empty list when nothing is new', () => {
    const seen = new Set(['a', 'b'])
    assert.deepEqual(newCidsSince(['a', 'b'], seen), [])
  })

  it('returns CIDs in arrival order, preserving channel order', () => {
    const seen = new Set(['a'])
    assert.deepEqual(newCidsSince(['a', 'b', 'c'], seen), ['b', 'c'])
  })

  it('handles an empty seen set as "everything is new"', () => {
    assert.deepEqual(newCidsSince(['a', 'b'], new Set()), ['a', 'b'])
  })

  it('handles an empty next list', () => {
    assert.deepEqual(newCidsSince([], new Set(['a'])), [])
  })

  it('does not mutate the seen set (caller owns that)', () => {
    const seen = new Set(['a'])
    newCidsSince(['a', 'b'], seen)
    assert.deepEqual([...seen], ['a'])
  })
})
