import { describe, expect, it } from 'vitest'
import { parseTiles, sortTiles } from '../domain/tiles'
import { buildDisplayPartition } from './partition'
import { resolveShapeSegments } from './rules'

describe('answer partition display', () => {
  it('uses actual suits, red fives, Japanese honors, and current hand order', () => {
    const hand = sortTiles(parseTiles('1456p268m05789s13z'), ['p', 'm', 's'])
    const segments = resolveShapeSegments(hand, [
      { id: 'pin-456', suit: 'p', pattern: '456' },
      { id: 'sou-789', suit: 's', pattern: '789' },
    ])
    const west = hand.find((tile) => tile.normalized === '3z')!
    expect(buildDisplayPartition(hand, west.id, segments)).toEqual(['1p', '456p', '2m', '68m', '05s', '789s', '東'])
  })

  it('keeps a loose 246 double-kanchan together instead of showing 2 plus 46', () => {
    const hand = sortTiles(parseTiles('123p456s55p12m46m78s'), ['p', 'm', 's'])
    const segments = resolveShapeSegments(hand, [
      { id: 'pin-123', suit: 'p', pattern: '123' },
      { id: 'sou-456', suit: 's', pattern: '456' },
    ])
    const oneMan = hand.find((tile) => tile.normalized === '1m')!
    expect(buildDisplayPartition(hand, oneMan.id, segments)).toEqual(['123p', '55p', '246m', '456s', '78s'])
  })
})
