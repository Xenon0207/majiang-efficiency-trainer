import { describe, expect, it } from 'vitest'
import { parseTiles } from '../domain/tiles'
import { resolveShapeSegments } from '../decomposition/rules'
import { buildHandGroupingModel, createHandGroupingState, selectedSuitPartition } from '../decomposition/hand-grouping'
import { evaluateDiscards } from '../solver/evaluate'
import { calculateShanten } from '../solver/shanten'
import { toCounts } from '../domain/tiles'
import { principles } from './principles'
import { questions } from './catalog'
import { PLAUSIBLE_UKEIRE_RATIO } from './config'

describe('1.0 content', () => {
  it('covers every registered principle', () => {
    const covered = new Set(questions.map((question) => question.principleId))
    expect(principles.filter((principle) => !covered.has(principle.id))).toEqual([])
  })

  it('contains six traceable static variants per principle', () => {
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
    for (const principle of principles) {
      const lesson = questions.filter((question) => question.principleId === principle.id)
      expect(lesson, principle.id).toHaveLength(6)
      expect(new Set(lesson.map((question) => question.generation?.suitTransform)).size, principle.id).toBe(6)
      expect(lesson.every((question) => question.generation?.generatorVersion === 'structured-variation-2')).toBe(true)
    }
  })

  it('covers varied isolated-honor scenarios instead of suit-only reskins', () => {
    const lesson = questions.filter((question) => question.principleId === 'TE-ISO-001')
    expect(new Set(lesson.map((question) => question.generation?.scenario))).toEqual(new Set([
      'guest-wind-and-dragon', 'winds-only', 'dragons-only', 'single-guest-wind', 'three-winds', 'honor-pair',
    ]))
    expect(lesson.some((question) => question.hand.match(/([1-4])\1z/))).toBe(true)
  })

  it('keeps red fives enabled and uses every number-suit display order', () => {
    expect(questions.some((question) => question.hand.includes('0'))).toBe(true)
    expect(new Set(questions.map((question) => question.suitOrder.join(''))).size).toBe(6)
    expect(questions.every((question) => question.dragonOrder.join('') === '5z6z7z')).toBe(true)
  })

  it('contains legal 14-tile hands at one or two shanten after discard', () => {
    for (const question of questions) {
      const hand = parseTiles(question.hand)
      expect(hand, question.id).toHaveLength(14)
      const evaluations = evaluateDiscards(hand, question.context.doraIndicator)
      expect([1, 2], `${question.id}: ${JSON.stringify(evaluations.slice(0, 3))}`).toContain(evaluations[0].shanten)
      resolveShapeSegments(hand, question.segments)
      expect(calculateShanten(toCounts(hand))).toBeGreaterThanOrEqual(0)
    }
  })

  it('has verified answers and at most three provisional plausible choices', () => {
    for (const question of questions) {
      const evaluations = evaluateDiscards(parseTiles(question.hand), question.context.doraIndicator)
      const bestShanten = evaluations[0].shanten
      const bestUkeire = Math.max(...evaluations.filter((item) => item.shanten === bestShanten).map((item) => item.ukeireCount))
      const plausible = evaluations.filter((item) => item.shanten === bestShanten && item.ukeireCount / bestUkeire >= PLAUSIBLE_UKEIRE_RATIO)
      expect(plausible.length, `${question.id}: ${plausible.map((item) => item.discard).join(',')}`).toBeLessThanOrEqual(3)
      expect(question.answerTiles.length, question.id).toBeGreaterThan(0)
      for (const answer of question.answerTiles) {
        const evaluation = evaluations.find((item) => item.discard === answer)
        expect(evaluation, `${question.id}: ${answer}`).toBeDefined()
        expect(evaluation?.shanten, question.id).toBe(bestShanten)
        expect((evaluation?.ukeireCount ?? 0) / bestUkeire, question.id).toBeGreaterThanOrEqual(PLAUSIBLE_UKEIRE_RATIO)
      }
    }
  })

  it('does not assign one physical tile to two teaching segments', () => {
    for (const question of questions) {
      const resolved = resolveShapeSegments(parseTiles(question.hand), question.segments)
      const ids = resolved.flatMap((segment) => segment.tileIds)
      expect(new Set(ids).size, question.id).toBe(ids.length)
    }
  })

  it('runs every basic lesson through the shared whole-hand organizer', () => {
    for (const question of questions) {
      const hand = parseTiles(question.hand)
      const model = buildHandGroupingModel(hand)
      const assignedIds = model.suits.flatMap((suit) =>
        selectedSuitPartition(suit, createHandGroupingState()).groups.flatMap((group) => group.tileIds),
      )
      expect(assignedIds, question.id).toHaveLength(hand.length)
      expect(new Set(assignedIds).size, question.id).toBe(hand.length)
      expect(new Set(assignedIds), question.id).toEqual(new Set(hand.map((tile) => tile.id)))
    }
  })
})
