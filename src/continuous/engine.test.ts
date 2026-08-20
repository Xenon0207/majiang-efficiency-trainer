import { describe, expect, it } from 'vitest'
import { continuousSessions } from './sessions'
import { declareKan, discardAndDraw, evaluateContinuousState, evaluateKanOptions, optimalChoicePercent, startContinuousSession, visibleCounts, type ContinuousState } from './engine'
import type { ContinuousSession } from './types'

describe('continuous efficiency training', () => {
  it('starts from a legal 14-tile hand and draws after a discard', () => {
    const session = continuousSessions[0]
    const start = startContinuousSession(session)
    expect(start.hand).toHaveLength(14)
    const evaluations = evaluateContinuousState(start, session)
    const discard = start.hand.find((tile) => tile.code === evaluations[0].discard)!
    const next = discardAndDraw(start, session, discard.id)
    expect(next.history).toHaveLength(1)
    expect(next.discards).toEqual([discard.code])
    if (!next.complete) expect(next.hand).toHaveLength(14)
  })

  it('counts the hand, own discards, and dora indicator as visible', () => {
    const session = continuousSessions[0]
    const start = startContinuousSession(session)
    const counts = visibleCounts(start.hand, ['1z'], session.context.doraIndicator)
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(16)
  })

  it('reports optimal-choice accuracy rather than raw ukeire retention', () => {
    const history = Array(9).fill({}) as ContinuousState['history']
    expect(optimalChoicePercent({ history, optimalTurns: 8 })).toBe(88.9)
    expect(optimalChoicePercent({ history: [], optimalTurns: 0 })).toBe(0)
  })

  it('ships only legal static sessions with fixed walls', () => {
    expect(continuousSessions).toHaveLength(16)
    let kanStarts = 0
    for (const session of continuousSessions) {
      expect(session.initialTiles).toHaveLength(13)
      expect(session.wall.length).toBeGreaterThanOrEqual(60)
      expect(new Set(session.dragonOrder)).toEqual(new Set(['5z', '6z', '7z']))
      expect(() => startContinuousSession(session)).not.toThrow()
      if (evaluateKanOptions(startContinuousSession(session), session).length > 0) kanStarts += 1
    }
    expect(kanStarts).toBeGreaterThanOrEqual(1)
  })

  it('declares a concealed kan, consumes an extra indicator, and draws a replacement tile', () => {
    const session: ContinuousSession = {
      id: 'kan-test', title: '杠测试', routeFocus: 'mixed',
      initialTiles: ['2s', '2s', '2s', '1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '1z', '1z'],
      wall: ['2s', '9m', '3p', '4s', '5s'],
      suitOrder: ['m', 'p', 's'], dragonOrder: ['5z', '6z', '7z'],
      context: { roundWind: '1z', seatWind: '2z', doraIndicator: '4m' },
      generation: { seed: 1, generatorVersion: 'test' },
    }
    const start = startContinuousSession(session)
    expect(evaluateKanOptions(start, session).map((value) => value.tile)).toContain('2s')
    const next = declareKan(start, session, '2s')
    expect(next.declaredKans).toEqual(['2s'])
    expect(next.doraIndicators).toEqual(['4m', '9m'])
    expect(next.hand).toHaveLength(11)
    expect(next.hand.some((tile) => tile.code === '3p')).toBe(true)
    expect(next.nextWallIndex).toBe(3)
    expect(next.history[0].action).toBe('kan')
  })
})
