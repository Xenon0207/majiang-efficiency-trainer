import { describe, expect, it } from 'vitest'
import type { DiscardEvaluation } from '../solver/evaluate'
import type { ContinuousDiscardTurn } from './engine'
import { classifyTurnSolution, compareEvaluationTiles, heuristicExplanation } from './feedback'

describe('continuous answer feedback', () => {
  it('accepts the non-dominated good-shape endpoint and exposes the speed counterpart', () => {
    const base = {
      shanten: 2, ukeireTiles: [], ukeireCount: 20, effectiveUkeireCount: 20, furiten: false,
      byTile: {}, retainedDora: 0, retainedYakuPotential: 0, standardShanten: 2, standardUkeireCount: 20,
      goodShapeTiles: [], badShapeTiles: [], improvementTiles: [], goodImprovementTiles: [], shapeByTile: {},
      qualityCalculated: true, transitions: [], nextUkeireExpectation: 20, speedDepth: 2,
    }
    const speedChoice = { ...base, discard: '5m', speedScore: 1.2, goodShapeCount: 8 } as DiscardEvaluation
    const shapeChoice = { ...base, discard: '1z', speedScore: 1.1, goodShapeCount: 12 } as DiscardEvaluation
    const candidates = [speedChoice, shapeChoice]
    const turn: ContinuousDiscardTurn = {
      turn: 1,
      action: 'discard',
      beforeHand: ['5m', '1z'],
      discard: shapeChoice.discard,
      chosen: shapeChoice,
      best: speedChoice,
      bestDiscards: [speedChoice.discard],
      recommendedKans: [],
      kanCandidates: [],
      candidates,
      optimal: false,
    }

    const feedback = classifyTurnSolution(turn)
    expect(feedback.kind).toBe('shape')
    expect(feedback.accepted).toBe(true)
    expect(feedback.equivalentKind).toBe('speed')
    expect(feedback.equivalent?.discard).toBe('5m')
  })

  it('explains why 24 should be dismantled before 35 when both choices are present', () => {
    const preferred = { discard: '2m', shanten: 2, effectiveUkeireCount: 20, goodShapeCount: 8, furiten: false } as never
    const compared = { discard: '3p', shanten: 2, effectiveUkeireCount: 20, goodShapeCount: 8, furiten: false } as never
    const turn = {
      action: 'discard',
      beforeHand: ['2m', '4m', '3p', '5p'],
    } as unknown as ContinuousDiscardTurn
    expect(heuristicExplanation(turn, preferred, compared)).toContain('35／57')
  })

  it('returns only the concrete advance, good-shape and improvement tiles that differ', () => {
    const preferred = {
      ukeireTiles: ['1m', '4m'],
      byTile: { '1m': 4, '4m': 4 },
      goodShapeTiles: ['1m'],
      goodImprovementTiles: ['3s'],
      improvementTiles: ['3s', '5p', '2p'],
      shapeByTile: { '1m': 4, '3s': 4, '5p': 4, '2p': 3 },
    } as unknown as DiscardEvaluation
    const chosen = {
      ukeireTiles: ['4m', '7p'],
      byTile: { '4m': 3, '7p': 4 },
      goodShapeTiles: ['7p'],
      goodImprovementTiles: ['6s'],
      improvementTiles: ['5p', '6s', '8s'],
      shapeByTile: { '7p': 4, '5p': 4, '6s': 4, '8s': 2 },
    } as unknown as DiscardEvaluation

    expect(compareEvaluationTiles(preferred, chosen)).toEqual([
      {
        kind: 'advance', preferred: ['1m', '4m'], chosen: ['7p'],
        preferredByTile: { '1m': 4, '4m': 1 }, chosenByTile: { '7p': 4 },
        preferredCount: 8, chosenCount: 7, commonCount: 3,
      },
      {
        kind: 'good', preferred: ['1m', '3s'], chosen: ['7p', '6s'],
        preferredByTile: { '1m': 4, '3s': 4 }, chosenByTile: { '7p': 4, '6s': 4 },
        preferredCount: 8, chosenCount: 8, commonCount: 0,
      },
      {
        kind: 'improvement', preferred: ['2p'], chosen: ['8s'],
        preferredByTile: { '2p': 3 }, chosenByTile: { '8s': 2 },
        preferredCount: 7, chosenCount: 6, commonCount: 4,
      },
    ])
  })

  it('describes equal-count ukeire swaps as shared copies plus the exchanged tiles', () => {
    const preferred = {
      ukeireTiles: ['1m', '3p'], byTile: { '1m': 3, '3p': 12 },
      goodShapeTiles: [], goodImprovementTiles: [], improvementTiles: [], shapeByTile: {},
    } as unknown as DiscardEvaluation
    const chosen = {
      ukeireTiles: ['8m', '3p'], byTile: { '8m': 3, '3p': 12 },
      goodShapeTiles: [], goodImprovementTiles: [], improvementTiles: [], shapeByTile: {},
    } as unknown as DiscardEvaluation

    expect(compareEvaluationTiles(preferred, chosen)).toEqual([{
      kind: 'advance',
      preferred: ['1m'], chosen: ['8m'],
      preferredByTile: { '1m': 3 }, chosenByTile: { '8m': 3 },
      preferredCount: 15, chosenCount: 15, commonCount: 12,
    }])
  })
})
