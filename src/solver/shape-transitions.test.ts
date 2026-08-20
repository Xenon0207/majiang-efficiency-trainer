import { describe, expect, it } from 'vitest'
import { analyzeLocalShape } from './shape-transitions'

describe('exact local shape frontier', () => {
  it('retains the two-ryanmen 2 / 45 / 56 / 8 interpretation of 245568', () => {
    const profile = analyzeLocalShape([0, 1, 0, 1, 2, 1, 0, 1, 0], 'p')
    expect(profile.frontier.some((value) => value.ryanmen >= 2)).toBe(true)
    expect(profile.ryanmenWaits).toEqual(expect.arrayContaining([3, 4, 6, 7]))
  })

  it('recognizes both sides of 67 inside 4677 without consulting other suits', () => {
    const pin = analyzeLocalShape([0, 0, 0, 1, 0, 1, 2, 0, 0], 'p')
    const sou = analyzeLocalShape([0, 0, 0, 1, 0, 1, 2, 0, 0], 's')
    expect(pin.ryanmenWaits).toEqual(expect.arrayContaining([5, 8]))
    expect(sou).toEqual(pin)
  })

  it('never creates a ryanmen from honor pairs', () => {
    const profile = analyzeLocalShape([1, 0, 0, 0, 0, 0, 0], 'z')
    expect(profile.maxRyanmen).toBe(0)
    expect(profile.ryanmenWaits).toEqual([])
  })
})
