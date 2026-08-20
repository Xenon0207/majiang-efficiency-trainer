import { describe, expect, it } from 'vitest'
import { parseTiles, toCounts } from '../domain/tiles'
import { calculateRouteShanten, calculateShanten, calculateUkeire } from './shanten'

function referenceStandardShanten(input: readonly number[], fixedMelds = 0): number {
  const counts = [...input]
  let best = 8 - fixedMelds * 2
  function visit(index: number, melds: number, head: number, taatsu: number) {
    while (index < 34 && counts[index] === 0) index += 1
    if (index >= 34) {
      best = Math.min(best, 8 - melds * 2 - Math.min(taatsu, Math.max(0, 4 - melds)) - head)
      return
    }
    visit(index + 1, melds, head, taatsu)
    if (counts[index] >= 3) {
      counts[index] -= 3
      visit(index, melds + 1, head, taatsu)
      counts[index] += 3
    }
    if (index < 27 && index % 9 <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      counts[index + 2] -= 1
      visit(index, melds + 1, head, taatsu)
      counts[index] += 1
      counts[index + 1] += 1
      counts[index + 2] += 1
    }
    if (counts[index] >= 2) {
      counts[index] -= 2
      if (head === 0) visit(index, melds, 1, taatsu)
      visit(index, melds, head, taatsu + 1)
      counts[index] += 2
    }
    if (index < 27 && index % 9 <= 7 && counts[index + 1] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      visit(index, melds, head, taatsu + 1)
      counts[index] += 1
      counts[index + 1] += 1
    }
    if (index < 27 && index % 9 <= 6 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 2] -= 1
      visit(index, melds, head, taatsu + 1)
      counts[index] += 1
      counts[index + 2] += 1
    }
  }
  visit(0, fixedMelds, 0, 0)
  return best
}

describe('shanten solver', () => {
  it('recognizes complete, tenpai, one-shanten and two-shanten hands', () => {
    expect(calculateShanten(toCounts(parseTiles('123m456m789p111s22z')))).toBe(-1)
    expect(calculateShanten(toCounts(parseTiles('123m456m789p11s22z')))).toBe(0)
    expect(calculateShanten(toCounts(parseTiles('123m456p78s11z567m')))).toBe(0)
    expect(calculateShanten(toCounts(parseTiles('123m456p79s11z567m')))).toBe(0)
  })

  it('calculates simple ukeire with remaining copies', () => {
    const counts = toCounts(parseTiles('123m456m789p11s22z'))
    const result = calculateUkeire(counts)
    expect(result.shanten).toBe(0)
    expect(result.tiles).toEqual(expect.arrayContaining(['1s', '2z']))
    expect(result.count).toBe(4)
  })

  it('supports chiitoi and kokushi only when enabled', () => {
    const chiitoi = toCounts(parseTiles('11m22m33p44p55s66s7z'))
    expect(calculateShanten(chiitoi, { includeChiitoi: true })).toBe(0)
    const kokushi = toCounts(parseTiles('19m19p19s1234567z'))
    expect(calculateShanten(kokushi, { includeKokushi: true })).toBe(0)
  })

  it('accounts for a fixed meld after a concealed kan', () => {
    const counts = toCounts(parseTiles('123m456p78s11z'))
    expect(calculateShanten(counts)).toBe(2)
    expect(calculateShanten(counts, { fixedMelds: 1 })).toBe(0)
  })

  it('matches the whole-hand reference solver across deterministic random hands', () => {
    let seed = 0x51a7e
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }
    for (const [tiles, fixedMelds] of [[13, 0], [10, 1]] as const) {
      for (let sample = 0; sample < 120; sample += 1) {
        const counts = Array<number>(34).fill(0)
        let total = 0
        while (total < tiles) {
          const index = Math.floor(random() * 34)
          if (counts[index] >= 4) continue
          counts[index] += 1
          total += 1
        }
        expect(calculateRouteShanten(counts, fixedMelds).standard).toBe(referenceStandardShanten(counts, fixedMelds))
      }
    }
  })
})
