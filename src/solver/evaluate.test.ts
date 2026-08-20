import { describe, expect, it } from 'vitest'
import { parseTiles, toCounts } from '../domain/tiles'
import { efficiencyBest, evaluateDiscards, evaluateShapeQuality } from './evaluate'
import { calculateUkeire } from './shanten'

describe('discard evaluation', () => {
  it('ranks discards by shanten and current ukeire', () => {
    const values = evaluateDiscards(parseTiles('123m456m789p1156s7z'), '9m')
    expect(values[0].shanten).toBe(0)
    expect(efficiencyBest(values).length).toBeGreaterThan(0)
  })

  it('distinguishes discarding a red five from a normal five', () => {
    const values = evaluateDiscards(parseTiles('123m4056m789p11s22z'), '4m')
    const red = values.find((value) => value.discard === '0m')
    const normal = values.find((value) => value.discard === '5m')
    expect(red?.retainedDora).toBeLessThan(normal?.retainedDora ?? 0)
  })

  it('always keeps the red five when red and normal five have identical efficiency', () => {
    const values = evaluateDiscards(parseTiles('05m123p456p789s11z2z'), '9s')
    const red = values.find((value) => value.discard === '0m')!
    const normal = values.find((value) => value.discard === '5m')!
    expect(normal.shanten).toBe(red.shanten)
    expect(normal.ukeireCount).toBe(red.ukeireCount)
    expect(normal.retainedDora).toBeGreaterThan(red.retainedDora)
    expect(values.indexOf(normal)).toBeLessThan(values.indexOf(red))
  })

  it('does not let a singleton value honor secretly break an efficiency tie', () => {
    const values = evaluateDiscards(parseTiles('123m456p789s11z3z6z8m'), '1p', {}, undefined, ['6z'])
    const guestWind = values.find((value) => value.discard === '3z')!
    const greenDragon = values.find((value) => value.discard === '6z')!
    expect(guestWind.shanten).toBe(greenDragon.shanten)
    expect(guestWind.ukeireCount).toBe(greenDragon.ukeireCount)
    expect(guestWind.retainedYakuPotential).toBe(greenDragon.retainedYakuPotential)
  })

  it('allows a singleton value honor to be discarded when every 2.0 speed and shape metric ties', () => {
    const values = evaluateDiscards(
      parseTiles('24s1249m1123469p1z'),
      '6m',
      { includeChiitoi: true, includeKokushi: true },
      undefined,
      ['1z'],
      true,
    )
    const east = values.find((value) => value.discard === '1z')!
    const ninePin = values.find((value) => value.discard === '9p')!

    expect(east).toMatchObject({
      shanten: ninePin.shanten,
      effectiveUkeireCount: ninePin.effectiveUkeireCount,
      speedScore: ninePin.speedScore,
      nextUkeireExpectation: ninePin.nextUkeireExpectation,
      goodShapeCount: ninePin.goodShapeCount,
      retainedDora: ninePin.retainedDora,
      standardShanten: ninePin.standardShanten,
      standardUkeireCount: ninePin.standardUkeireCount,
      retainedYakuPotential: ninePin.retainedYakuPotential,
    })
    expect(efficiencyBest(values).map((value) => value.discard)).toEqual(expect.arrayContaining(['1z', '9p']))
  })

  it('classifies broad ryanmen waits as good shape and single waits as non-good shape', () => {
    const broadCounts = toCounts(parseTiles('123m456m789m23p11s'))
    const broadUkeire = calculateUkeire(broadCounts)
    expect(evaluateShapeQuality(broadCounts, broadUkeire, {}, broadCounts).goodShapeCount).toBeGreaterThan(0)

    const narrowCounts = toCounts(parseTiles('123m456m789m13p11s'))
    const narrowUkeire = calculateUkeire(narrowCounts)
    expect(evaluateShapeQuality(narrowCounts, narrowUkeire, {}, narrowCounts).goodShapeCount).toBe(0)

    const shanponCounts = toCounts(parseTiles('123m456m789m11p22s'))
    const shanponUkeire = calculateUkeire(shanponCounts)
    expect(shanponUkeire.tiles).toHaveLength(2)
    expect(evaluateShapeQuality(shanponCounts, shanponUkeire, {}, shanponCounts).goodShapeCount).toBe(0)
  })

  it('breaks equal-shanten equal-ukeire ties by preserving the better future shape', () => {
    const values = evaluateDiscards(parseTiles('1268s1238m24556p1z'), '9p', { includeChiitoi: true, includeKokushi: true }, undefined, [], true)
    const floatingEight = values.find((value) => value.discard === '8m')!
    const east = values.find((value) => value.discard === '1z')!
    expect(east.shanten).toBe(floatingEight.shanten)
    expect(east.ukeireCount).toBe(floatingEight.ukeireCount)
    expect(east.goodShapeCount).toBeGreaterThan(floatingEight.goodShapeCount)
    expect(values.indexOf(east)).toBeLessThan(values.indexOf(floatingEight))
  })

  it('keeps a real ryanmen source instead of an isolated guest wind', () => {
    const hand = parseTiles('222469s2223p9m167z')
    const visible = toCounts([...hand, ...parseTiles('1s')])
    const values = evaluateDiscards(hand, '1s', { includeChiitoi: true, includeKokushi: true }, visible, ['6z', '7z'], true)
    const east = values.find((value) => value.discard === '1z')!
    const threePin = values.find((value) => value.discard === '3p')!
    expect(east.shanten).toBe(threePin.shanten)
    expect(east.goodShapeCount).toBeGreaterThan(threePin.goodShapeCount)
    expect(values[0].discard).toBe('1z')
  })

  it('lists a draw that adds another ryanmen as an improvement even without more raw ukeire', () => {
    const hand = parseTiles('368m3479p1344s344z')
    const visible = toCounts([...hand, ...parseTiles('6p')])
    const values = evaluateDiscards(hand, '6p', { includeChiitoi: true, includeKokushi: true }, visible, [], true)
    const west = values.find((value) => value.discard === '3z')!
    expect(west.improvementTiles).toContain('2m')
  })

  it('never calls an honor-pair draw good just because another ryanmen remains in the hand', () => {
    const hand = parseTiles('13m24556p289s1356z')
    const visible = toCounts([...hand, ...parseTiles('7s')])
    const values = evaluateDiscards(hand, '7s', { includeChiitoi: true, includeKokushi: true }, visible, [], true)
    const cutTwoSou = values.find((value) => value.discard === '2s')!
    expect(cutTwoSou.goodShapeTiles.every((tile) => !tile.endsWith('z'))).toBe(true)
    expect(cutTwoSou.badShapeTiles).toEqual(expect.arrayContaining(['1z', '3z', '5z', '6z']))
  })

  it('keeps current ukeire primary while still calculating complete facts for every same-shanten candidate', () => {
    const hand = parseTiles('12359m456p778s')
    const visible = toCounts([...hand, ...parseTiles('2222s1s9s')])
    const values = evaluateDiscards(hand, ['1s', '9s'], { fixedMelds: 1 }, visible, [], true)
    const sevenSou = values.find((value) => value.discard === '7s')!
    const nineMan = values.find((value) => value.discard === '9m')!
    expect(sevenSou.ukeireCount).toBe(13)
    expect((sevenSou.byTile['6s'] ?? 0) + (sevenSou.byTile['9s'] ?? 0)).toBe(7)
    expect(nineMan.ukeireCount).toBe(30)
    expect(sevenSou.nextUkeireExpectation).toBeTypeOf('number')
    expect(sevenSou.qualityCalculated).toBe(true)
    expect(nineMan.nextUkeireExpectation).toBeTypeOf('number')
    expect(nineMan.qualityCalculated).toBe(true)
    expect(values[0].discard).not.toBe('7s')
    expect(values[0].ukeireCount).toBeGreaterThanOrEqual(27)
  })

  it('counts ryanmen route improvements even when chiitoi currently leads without overriding the speed score', () => {
    const hand = parseTiles('11225m3344p556s12z')
    const visible = toCounts([...hand, ...parseTiles('5m')])
    const values = evaluateDiscards(hand, '5m', { includeChiitoi: true, includeKokushi: true }, visible, [], true)
    const east = values.find((value) => value.discard === '1z')!
    const fiveMan = values.find((value) => value.discard === '5m')!
    expect(east.shanten).toBe(fiveMan.shanten)
    expect(fiveMan.ukeireCount - east.ukeireCount).toBe(1)
    expect(Math.abs((fiveMan.nextUkeireExpectation ?? 0) - (east.nextUkeireExpectation ?? 0))).toBeLessThanOrEqual(0.5)
    expect(east.improvementTiles).toEqual(expect.arrayContaining(['4m', '6m']))
    expect(east.goodShapeCount).toBeGreaterThan(fiveMan.goodShapeCount)
    expect(fiveMan.speedScore).toBeGreaterThan(east.speedScore ?? 0)
    expect(values[0].discard).toBe('5m')
  })

  it('prefers discarding a singleton dragon when that preserves the wider standard-hand route', () => {
    const hand = parseTiles('2277m11335p2488s6z')
    const values = evaluateDiscards(hand, '9s', { includeChiitoi: true, includeKokushi: true }, undefined, ['6z'], true)
    const twoSou = values.find((value) => value.discard === '2s')!
    const greenDragon = values.find((value) => value.discard === '6z')!
    expect(greenDragon.shanten).toBe(twoSou.shanten)
    expect(greenDragon.ukeireCount).toBe(twoSou.ukeireCount)
    expect(greenDragon.nextUkeireExpectation).toBe(twoSou.nextUkeireExpectation)
    expect(greenDragon.goodShapeCount).toBe(twoSou.goodShapeCount)
    expect(greenDragon.standardShanten).toBeLessThanOrEqual(twoSou.standardShanten)
    expect(greenDragon.standardUkeireCount).toBeGreaterThan(twoSou.standardUkeireCount)
    expect(values[0].discard).toBe('6z')
  })

  it('does not let one extra honor-pair ukeire change an otherwise identical good-shape count', () => {
    const hand = parseTiles('799m23558p47s2556z')
    const visible = toCounts([...hand, ...parseTiles('6z')])
    const values = evaluateDiscards(hand, '1s', { includeChiitoi: true, includeKokushi: true }, visible, ['6z'], true)
    const south = values.find((value) => value.discard === '2z')!
    const greenDragon = values.find((value) => value.discard === '6z')!
    expect(greenDragon.ukeireCount - south.ukeireCount).toBe(1)
    expect(greenDragon.nextUkeireExpectation).toBe(south.nextUkeireExpectation)
    expect(greenDragon.goodShapeCount).toBe(south.goodShapeCount)
    expect(south.improvementTiles).toContain('8m')
    expect(greenDragon.improvementTiles).toContain('8m')
    expect(values[0].discard).toBe('6z')
  })

  it('counts absolute good-shape copies instead of rewarding the smaller denominator', () => {
    const hand = parseTiles('1238m24556p12689s')
    const visible = toCounts([...hand, ...parseTiles('7s1356z')])
    const values = evaluateDiscards(hand, '7s', { includeChiitoi: true, includeKokushi: true }, visible, [], true)
    const twoPin = values.find((value) => value.discard === '2p')!
    const nineSou = values.find((value) => value.discard === '9s')!
    expect(twoPin.goodShapeCount).toBe(nineSou.goodShapeCount)
    expect(twoPin.goodImprovementTiles).toContain('3p')
    expect(nineSou.improvementTiles).toContain('6s')
    expect(nineSou.goodImprovementTiles).not.toContain('6s')
    expect(twoPin.improvementTiles).not.toContain('2p')
    expect(nineSou.improvementTiles).not.toContain('9s')
  })

  it('keeps an unchanged-suit 8m improvement consistent across 8p and 8s discards', () => {
    const hand = parseTiles('33668p458s1366m22z')
    const values = evaluateDiscards(hand, '1z', { includeChiitoi: true, includeKokushi: true }, undefined, [], true)
    const cutEightPin = values.find((value) => value.discard === '8p')!
    const cutEightSou = values.find((value) => value.discard === '8s')!
    expect(cutEightPin.shanten).toBe(cutEightSou.shanten)
    expect(cutEightPin.ukeireCount).toBe(cutEightSou.ukeireCount)
    expect(cutEightPin.improvementTiles).toContain('8m')
    expect(cutEightSou.improvementTiles).toContain('8m')
  })

  it('never hides unchanged 4677s structure when a different man tile is discarded', () => {
    const hand = parseTiles('4677s13677m45679p')
    const values = evaluateDiscards(hand, '1z', { includeChiitoi: true, includeKokushi: true }, undefined, [], true)

    for (const discard of ['1m', '3m', '6m', '7m'] as const) {
      const value = values.find((candidate) => candidate.discard === discard)!
      const relevantSou = new Set([...value.ukeireTiles, ...value.improvementTiles].filter((tile) => tile.endsWith('s')))
      expect([...relevantSou]).toEqual(expect.arrayContaining(['5s', '7s', '8s']))
      expect(value.transitions.find((fact) => fact.tile === '8s')).toBeDefined()
    }
  })

  it('discounts the whole wait when any theoretical wait is in the own river', () => {
    const hand = parseTiles('23m123456p789s112z')
    // 1m 已经四张全可见，所以实时受入列表只剩 4m；振听仍须检查理论完整的 1m/4m 待牌。
    const visible = toCounts([...hand, ...parseTiles('1111m')])
    const values = evaluateDiscards(hand, '9s', {}, visible, [], true, ['1m'])
    const south = values.find((value) => value.discard === '2z')!

    expect(south.shanten).toBe(0)
    expect(south.ukeireTiles).toEqual(['4m'])
    expect(south.furiten).toBe(true)
    expect(south.effectiveUkeireCount).toBe(south.ukeireCount / 4)
  })

  it('does not discount the same wait when the own river misses every wait tile', () => {
    const hand = parseTiles('23m123456p789s112z')
    const values = evaluateDiscards(hand, '9s', {}, undefined, [], true, ['9m'])
    const south = values.find((value) => value.discard === '2z')!

    expect(south.furiten).toBe(false)
    expect(south.effectiveUkeireCount).toBe(south.ukeireCount)
  })
})
