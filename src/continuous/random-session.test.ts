import { describe, expect, it } from 'vitest'
import { normalizeTile, parseTiles, toCounts } from '../domain/tiles'
import { startContinuousSession } from './engine'
import { createRandomContinuousSession } from './random-session'

describe('runtime random continuous sessions', () => {
  it('deals a reproducible legal wall with one red five in every suit', () => {
    const session = createRandomContinuousSession(20260820)
    const repeated = createRandomContinuousSession(20260820)
    expect(repeated).toEqual(session)
    expect(session.initialTiles).toHaveLength(13)
    expect(session.wall).toHaveLength(122)

    const allTiles = [...session.initialTiles, session.context.doraIndicator, ...session.wall]
    expect(allTiles).toHaveLength(136)
    expect(toCounts(parseTiles(allTiles.join(''))).every((count) => count === 4)).toBe(true)
    expect(allTiles.filter((tile) => tile.startsWith('0')).sort()).toEqual(['0m', '0p', '0s'])
    expect(() => startContinuousSession(session)).not.toThrow()
  })

  it('changes the hand, indicator, or wall when the seed changes', () => {
    const first = createRandomContinuousSession(1)
    const second = createRandomContinuousSession(2)
    const signature = (session: ReturnType<typeof createRandomContinuousSession>) =>
      [...session.initialTiles.map(normalizeTile), session.context.doraIndicator, ...session.wall].join(',')
    expect(signature(first)).not.toBe(signature(second))
  })
})
