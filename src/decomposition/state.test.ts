import { describe, expect, it } from 'vitest'
import { parseTiles } from '../domain/tiles'
import { inferShapeSegments, resolveShapeSegments, sortedVariants } from './rules'
import { arrangeHandByDecomposition, clickDecomposition, createDecompositionState, prepareHandChange, visibleGroups } from './state'

describe('decomposition state', () => {
  it('locks forced shapes on the first tap anywhere', () => {
    const hand = parseTiles('234m2334p55z123s')
    const segments = resolveShapeSegments(hand, [
      { id: 'm-234', suit: 'm', pattern: '234' },
      { id: 'p-2334', suit: 'p', pattern: '2334' },
    ])
    let state = createDecompositionState(segments)
    state = clickDecomposition(state, segments, hand.find((tile) => tile.suit === 's')!.id)
    expect(visibleGroups(state, segments[0])).toEqual(['234'])
    expect(visibleGroups(state, segments[1])).toBeNull()
  })

  it('cycles 2334 by tapping any tile in the shape', () => {
    const hand = parseTiles('2334m123p789s55z2p')
    const segments = resolveShapeSegments(hand, [{ id: 'm-2334', suit: 'm', pattern: '2334' }])
    let state = createDecompositionState(segments)
    const target = hand.find((tile) => tile.normalized === '3m')!
    state = clickDecomposition(state, segments, target.id)
    expect(visibleGroups(state, segments[0])).toEqual(['23', '34'])
    state = clickDecomposition(state, segments, target.id)
    expect(visibleGroups(state, segments[0])).toEqual(['234', '3'])
  })

  it('keeps 246 as one efficient double-kanchan shape', () => {
    const segment = resolveShapeSegments(parseTiles('246m123p789s55z2p'), [{ id: 'x', suit: 'm', pattern: '246' }])[0]
    expect(sortedVariants(segment.rule).map((item) => item.groups)).toEqual([['246']])
  })

  it('waits for a tap to reveal a changed shape', () => {
    const oldHand = parseTiles('234m123p789s55z12p')
    const oldSegments = resolveShapeSegments(oldHand, [{ id: 'main', suit: 'm', pattern: '234' }])
    let state = clickDecomposition(createDecompositionState(oldSegments), oldSegments, oldHand[0].id)
    const nextHand = parseTiles('2334m123p789s55z1p')
    const prepared = prepareHandChange(state, nextHand, [{ id: 'main', suit: 'm', pattern: '2334' }])
    expect(visibleGroups(prepared.state, prepared.segments[0])).toBeNull()
    state = clickDecomposition(prepared.state, prepared.segments, nextHand[0].id)
    expect(visibleGroups(state, prepared.segments[0])).toEqual(['23', '34'])
  })

  it('locks two-tile pairs and gaps and arranges interleaved groups', () => {
    const hand = parseTiles('335577p68m88s123m')
    const segments = inferShapeSegments(hand)
    let state = createDecompositionState(segments)
    const doubleKanchan = segments.find((segment) => segment.pattern === '335577')!
    state = clickDecomposition(state, segments, doubleKanchan.tileIds[0])
    expect(visibleGroups(state, segments.find((segment) => segment.pattern === '68')!)).toEqual(['68'])
    expect(visibleGroups(state, segments.find((segment) => segment.pattern === '88')!)).toEqual(['88'])
    const arranged = arrangeHandByDecomposition(hand, segments, state)
    expect(arranged.filter((tile) => tile.suit === 'p').map((tile) => tile.rank).join('')).toBe('357357')
  })
})
