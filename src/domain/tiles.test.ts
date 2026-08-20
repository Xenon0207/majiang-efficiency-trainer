import { describe, expect, it } from 'vitest'
import { doraFromIndicator, parseTiles, sortTiles, tileImage, tileLabel, toCounts } from './tiles'

describe('tiles', () => {
  it('parses red fives and normalizes counts', () => {
    const tiles = parseTiles('405m123p77z')
    expect(tiles).toHaveLength(8)
    expect(tiles.filter((tile) => tile.normalized === '5m')).toHaveLength(2)
    expect(toCounts(tiles).reduce((a, b) => a + b, 0)).toBe(8)
  })

  it('sorts suits by the question order and honors canonically', () => {
    const tiles = sortTiles(parseTiles('12m12p12s7654321z'), ['s', 'm', 'p'])
    expect(tiles.map((tile) => tile.normalized).join(' ')).toBe('1s 2s 1m 2m 1p 2p 1z 2z 3z 4z 5z 6z 7z')
  })

  it('keeps winds fixed while rotating dragons in 2.0', () => {
    const tiles = sortTiles(parseTiles('7654321z'), ['m', 'p', 's'], ['7z', '5z', '6z'])
    expect(tiles.map((tile) => tile.normalized).join(' ')).toBe('1z 2z 3z 4z 7z 5z 6z')
  })

  it('uses wind and dragon dora cycles', () => {
    expect(doraFromIndicator('4z')).toBe('1z')
    expect(doraFromIndicator('7z')).toBe('5z')
    expect(tileLabel('0p')).toBe('赤5饼')
    expect(tileImage('1m')).toBe('./tiles/Man1.png')
    expect(tileImage('7z')).toBe('./tiles/Chun.png')
  })
})
