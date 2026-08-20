import { describe, expect, it } from 'vitest'
import { parseTiles } from '../domain/tiles'
import { groupTileIds, inferShapeSegments, sortedVariants } from './rules'

describe('automatic shape lookup for continuous hands', () => {
  it('covers every tile exactly once with rule-table groups', () => {
    const hand = parseTiles('123m2468p55s117z')
    const segments = inferShapeSegments(hand)
    const ids = segments.flatMap((segment) => segment.tileIds)
    expect(ids).toHaveLength(hand.length)
    expect(new Set(ids).size).toBe(hand.length)
    expect(segments.some((segment) => segment.pattern === '2468')).toBe(true)
    expect(segments.some((segment) => segment.suit === 'z' && segment.pattern === '11')).toBe(true)
  })

  it('cycles 335577 between two interleaved 357 groups and three pairs', () => {
    const hand = parseTiles('335577p123m456s11z')
    const segment = inferShapeSegments(hand).find((item) => item.pattern === '335577')!
    const variants = sortedVariants(segment.rule)
    expect(variants.map((item) => item.groups)).toEqual([
      ['357', '357'],
      ['33', '55', '77'],
    ])
    const mapped = groupTileIds(segment, variants[0].groups)
    expect(mapped.map((ids) => ids.map((id) => id[0]).join(''))).toEqual(['357', '357'])
    expect(new Set(mapped.flat()).size).toBe(6)
  })
})
