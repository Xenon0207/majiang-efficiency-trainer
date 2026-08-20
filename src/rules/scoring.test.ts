import { describe, expect, it } from 'vitest'
import { calculateScore } from './scoring'
import { MAJSOUL_RULESET } from './majsoul-ruleset'

describe('Mahjong Soul scoring profile', () => {
  it('uses three red fives, open tanyao and no kiriage mangan', () => {
    expect(MAJSOUL_RULESET.redFives).toBe(3)
    expect(MAJSOUL_RULESET.openTanyao).toBe(true)
    expect(MAJSOUL_RULESET.kiriageMangan).toBe(false)
  })

  it('preserves the common non-rounded ron values requested by the ruleset', () => {
    expect(calculateScore({ han: 2, fu: 40, dealer: false, method: 'ron' }).total).toBe(2600)
    expect(calculateScore({ han: 3, fu: 40, dealer: false, method: 'ron' }).total).toBe(5200)
    expect(calculateScore({ han: 4, fu: 30, dealer: false, method: 'ron' }).total).toBe(7700)
    expect(calculateScore({ han: 4, fu: 30, dealer: true, method: 'ron' }).total).toBe(11600)
  })

  it('uses normal limit tiers and child/dealer tsumo splits', () => {
    expect(calculateScore({ han: 5, fu: 30, dealer: false, method: 'ron' }).label).toBe('8000点')
    expect(calculateScore({ han: 6, fu: 30, dealer: false, method: 'ron' }).label).toBe('12000点')
    expect(calculateScore({ han: 3, fu: 30, dealer: false, method: 'tsumo' }).label).toBe('1000 / 2000点')
    expect(calculateScore({ han: 3, fu: 30, dealer: true, method: 'tsumo' }).label).toBe('2000点∀')
  })
})
