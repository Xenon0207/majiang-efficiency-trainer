import { describe, expect, it } from 'vitest'
import { parseTiles } from '../domain/tiles'
import {
  arrangeHandForGrouping,
  buildHandGroupingModel,
  clickHandGrouping,
  createHandGroupingState,
  formatGroup,
  handGroupMarks,
  selectedSuitPartition,
} from './hand-grouping'

function signatures(notation: string): string[] {
  const model = buildHandGroupingModel(parseTiles(notation))
  return model.suits[0].variants.map((variant) => variant.groups.map((group) => group.ranks.join('')).join('|'))
}

describe('whole-suit hand grouping', () => {
  it('keeps the important 2222446 alternatives', () => {
    const values = signatures('2222446s')
    expect(values).toContain('222|24|46')
    expect(values).toContain('2222|44|6')
    expect(values).toContain('2222|46|4')
    expect(values).toContain('222|246|4')
  })

  it('considers a quad and never marks its singleton alternative as locked', () => {
    const hand = parseTiles('2222s')
    const model = buildHandGroupingModel(hand)
    expect(signatures('2222s')).toContain('2222')
    expect(signatures('2222s')).toContain('222|2')
    const state = clickHandGrouping(createHandGroupingState(), model, hand[0].id)
    const marks = handGroupMarks(model, state)
    const partition = selectedSuitPartition(model.suits[0], state)
    for (const singleton of partition.groups.filter((group) => group.kind === 'single')) {
      expect(marks.has(singleton.tileIds[0])).toBe(false)
    }
  })

  it('locks an unambiguous two-tile wait but leaves floating tiles unmarked', () => {
    const hand = parseTiles('68p19m')
    const model = buildHandGroupingModel(hand)
    const state = clickHandGrouping(createHandGroupingState(), model, hand[0].id)
    const marks = handGroupMarks(model, state)
    const suited = hand.filter((tile) => tile.suit === 'p')
    expect(suited.every((tile) => marks.get(tile.id)?.status === 'locked')).toBe(true)
    expect(hand.filter((tile) => tile.suit === 'm').every((tile) => !marks.has(tile.id))).toBe(true)
  })

  it('can arrange 335577 as two visible 357 groups', () => {
    const hand = parseTiles('335577p')
    const model = buildHandGroupingModel(hand)
    const target = model.suits[0].variants.findIndex((variant) => variant.groups.map((group) => group.ranks.join('')).join('|') === '357|357')
    expect(target).toBeGreaterThanOrEqual(0)
    const state = { interacted: true, cycleBySuit: { p: target } } as const
    expect(arrangeHandForGrouping(hand, model, state).map((tile) => tile.rank).join('')).toBe('357357')
  })

  it('keeps both overlapping ryanmen in 245568 as a meaningful alternative', () => {
    const values = signatures('245568p')
    expect(values).toContain('2|45|56|8')
    expect(values.indexOf('2|45|56|8')).toBeLessThan(values.indexOf('2468|55'))
  })

  it('formats every numeric group with an explicit suit suffix', () => {
    expect(formatGroup({ kind: 'composite', ranks: [2, 4, 6] }, 'p')).toBe('246p')
    expect(formatGroup({ kind: 'single', ranks: [2] }, 'm')).toBe('2m')
    expect(formatGroup({ kind: 'pair', ranks: [1, 1] }, 'z')).toBe('东东')
  })

  it('uses each physical tile exactly once in every candidate', () => {
    const hand = parseTiles('2222446s335577p1m')
    const model = buildHandGroupingModel(hand)
    for (const suit of model.suits) {
      for (const variant of suit.variants) {
        expect(variant.groups.flatMap((group) => group.tileIds).sort()).toEqual([...suit.tileIds].sort())
      }
    }
  })
})
