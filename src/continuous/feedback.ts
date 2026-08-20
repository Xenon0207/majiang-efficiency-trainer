import { normalizeTile, parseTiles, tileToIndex, toCounts, type TileCode } from '../domain/tiles'
import { effectiveGoodShapeCount, type DiscardEvaluation } from '../solver/evaluate'
import type { ContinuousTurn } from './engine'

export type TurnSolutionKind = 'optimal' | 'speed' | 'shape' | 'missed'

export interface TurnSolutionFeedback {
  kind: TurnSolutionKind
  accepted: boolean
  equivalent?: DiscardEvaluation
  equivalentKind?: 'speed' | 'shape'
}

export interface TileDifferenceLine {
  kind: 'advance' | 'good' | 'improvement'
  preferred: TileCode[]
  chosen: TileCode[]
  preferredByTile: Record<string, number>
  chosenByTile: Record<string, number>
  preferredCount: number
  chosenCount: number
  commonCount: number
}

function speedValue(value: DiscardEvaluation): number {
  return value.speedScore ?? value.effectiveUkeireCount
}

function goodValue(value: DiscardEvaluation): number {
  return effectiveGoodShapeCount(value.goodShapeCount, value.furiten)
}

function discardParetoFront(candidates: readonly DiscardEvaluation[]): DiscardEvaluation[] {
  const minimumShanten = Math.min(...candidates.map((value) => value.shanten))
  const eligible = candidates.filter((value) => value.shanten === minimumShanten)
  return eligible.filter((candidate) => !eligible.some((other) =>
    other !== candidate &&
    speedValue(other) >= speedValue(candidate) &&
    goodValue(other) >= goodValue(candidate) &&
    (speedValue(other) > speedValue(candidate) || goodValue(other) > goodValue(candidate)),
  ))
}

/**
 * “最优”仍指完整2.0评价器的答案；若速度与好型确实互不支配，则允许前沿两端分别作为绿色的速度解和好型解。
 */
export function classifyTurnSolution(turn: ContinuousTurn): TurnSolutionFeedback {
  if (turn.optimal) return { kind: 'optimal', accepted: true }
  if (turn.action === 'kan') return { kind: 'missed', accepted: false }

  const frontier = discardParetoFront(turn.candidates)
  const chosen = frontier.find((value) => value.discard === turn.discard)
  if (!chosen) return { kind: 'missed', accepted: false }

  const maximumSpeed = Math.max(...frontier.map(speedValue))
  const maximumGood = Math.max(...frontier.map(goodValue))
  const speedLeaders = frontier.filter((value) => speedValue(value) === maximumSpeed)
  const shapeLeaders = frontier.filter((value) => goodValue(value) === maximumGood)

  if (speedValue(chosen) === maximumSpeed) {
    const equivalent = shapeLeaders.find((value) => value.discard !== chosen.discard)
    return { kind: 'speed', accepted: true, equivalent, equivalentKind: equivalent ? 'shape' : undefined }
  }
  if (goodValue(chosen) === maximumGood) {
    const equivalent = speedLeaders.find((value) => value.discard !== chosen.discard)
    return { kind: 'shape', accepted: true, equivalent, equivalentKind: equivalent ? 'speed' : undefined }
  }
  return { kind: 'missed', accepted: false }
}

function differingTiles(
  preferredTiles: readonly TileCode[],
  chosenTiles: readonly TileCode[],
  preferredByTile: Readonly<Record<string, number>>,
  chosenByTile: Readonly<Record<string, number>>,
): Omit<TileDifferenceLine, 'kind'> {
  const preferred = new Map(preferredTiles.map((tile) => [normalizeTile(tile), tile]))
  const chosen = new Map(chosenTiles.map((tile) => [normalizeTile(tile), tile]))
  const tileTypes = [...new Set([...preferred.keys(), ...chosen.keys()])]
  const result: Omit<TileDifferenceLine, 'kind'> = {
    preferred: [],
    chosen: [],
    preferredByTile: {},
    chosenByTile: {},
    preferredCount: 0,
    chosenCount: 0,
    commonCount: 0,
  }

  for (const tileType of tileTypes) {
    const preferredTile = preferred.get(tileType)
    const chosenTile = chosen.get(tileType)
    const preferredCount = preferredTile ? preferredByTile[preferredTile] ?? preferredByTile[tileType] ?? 0 : 0
    const chosenCount = chosenTile ? chosenByTile[chosenTile] ?? chosenByTile[tileType] ?? 0 : 0
    result.preferredCount += preferredCount
    result.chosenCount += chosenCount
    result.commonCount += Math.min(preferredCount, chosenCount)
    if (preferredCount > chosenCount && preferredTile) {
      result.preferred.push(preferredTile)
      result.preferredByTile[preferredTile] = preferredCount - chosenCount
    }
    if (chosenCount > preferredCount && chosenTile) {
      result.chosen.push(chosenTile)
      result.chosenByTile[chosenTile] = chosenCount - preferredCount
    }
  }
  return result
}

/**
 * 把两个切法的差距还原成具体摸牌：先比较降向听进张，再比较真实好型与同向听改良。
 * 同一张牌在两边作用不同（例如一边是好型、另一边只是普通进张）时会出现在对应一行。
 */
export function compareEvaluationTiles(
  preferred: DiscardEvaluation,
  chosen: DiscardEvaluation,
): TileDifferenceLine[] {
  const preferredGood = [...new Set([...preferred.goodShapeTiles, ...preferred.goodImprovementTiles])]
  const chosenGood = [...new Set([...chosen.goodShapeTiles, ...chosen.goodImprovementTiles])]
  const preferredGoodImprovements = new Set(preferred.goodImprovementTiles.map(normalizeTile))
  const chosenGoodImprovements = new Set(chosen.goodImprovementTiles.map(normalizeTile))
  const preferredOtherImprovements = preferred.improvementTiles.filter((tile) => !preferredGoodImprovements.has(normalizeTile(tile)))
  const chosenOtherImprovements = chosen.improvementTiles.filter((tile) => !chosenGoodImprovements.has(normalizeTile(tile)))
  const lines: TileDifferenceLine[] = [
    {
      kind: 'advance',
      ...differingTiles(preferred.ukeireTiles, chosen.ukeireTiles, preferred.byTile, chosen.byTile),
    },
    {
      kind: 'good',
      ...differingTiles(preferredGood, chosenGood, preferred.shapeByTile, chosen.shapeByTile),
    },
    {
      kind: 'improvement',
      ...differingTiles(preferredOtherImprovements, chosenOtherImprovements, preferred.shapeByTile, chosen.shapeByTile),
    },
  ]
  return lines.filter((line) => line.preferred.length > 0 || line.chosen.length > 0)
}

type LocalShape = 'ryanmen' | 'good-kanchan' | 'ordinary-kanchan' | 'weak-kanchan' | 'penchan'

const SHAPE_STRENGTH: Record<LocalShape, number> = {
  ryanmen: 5,
  'good-kanchan': 4,
  'ordinary-kanchan': 3,
  'weak-kanchan': 2,
  penchan: 1,
}

function localShapesForDiscard(beforeHand: readonly TileCode[], discard: TileCode): LocalShape[] {
  const normalized = normalizeTile(discard)
  if (normalized.endsWith('z')) return []
  const counts = toCounts(parseTiles(beforeHand.join('')))
  const index = tileToIndex(normalized)
  const rank = Number(normalized[0])
  const suitStart = index - (rank - 1)
  const shapes = new Set<LocalShape>()

  for (let otherRank = 1; otherRank <= 9; otherRank += 1) {
    if (otherRank === rank || counts[suitStart + otherRank - 1] === 0) continue
    const low = Math.min(rank, otherRank)
    const high = Math.max(rank, otherRank)
    if (high - low === 1) {
      shapes.add(low === 1 || low === 8 ? 'penchan' : 'ryanmen')
    } else if (high - low === 2) {
      if ((low === 3 && high === 5) || (low === 5 && high === 7)) shapes.add('good-kanchan')
      else if ((low === 2 && high === 4) || (low === 6 && high === 8)) shapes.add('ordinary-kanchan')
      else shapes.add('weak-kanchan')
    }
  }
  return [...shapes]
}

function strongestLocalShape(beforeHand: readonly TileCode[], discard: TileCode): LocalShape | undefined {
  return localShapesForDiscard(beforeHand, discard).sort((a, b) => SHAPE_STRENGTH[b] - SHAPE_STRENGTH[a])[0]
}

/** 只在命中清晰定式时返回一句短解释；模糊复合形交给数值与展开明细说明。 */
export function heuristicExplanation(
  turn: ContinuousTurn,
  preferred: DiscardEvaluation | undefined,
  compared: DiscardEvaluation | undefined,
): string | undefined {
  if (turn.action !== 'discard' || !preferred || !compared) return undefined
  const preferredShape = strongestLocalShape(turn.beforeHand, preferred.discard)
  const comparedShape = strongestLocalShape(turn.beforeHand, compared.discard)

  if (preferredShape === 'ordinary-kanchan' && comparedShape === 'good-kanchan') {
    return '坎张也有强弱：35／57的中张改良优于24／68，因此先拆24／68。'
  }
  if (preferredShape === 'penchan' && comparedShape && SHAPE_STRENGTH[comparedShape] > SHAPE_STRENGTH.penchan) {
    return '搭子价值通常是两面、优质坎张、普通坎张、边张依次下降，先拆边张。'
  }
  if (preferredShape && comparedShape === 'ryanmen' && SHAPE_STRENGTH[preferredShape] < SHAPE_STRENGTH.ryanmen) {
    return '受入接近时优先保留真正两面，避免先破坏两方向进张。'
  }
  if (preferred.shanten === compared.shanten && preferred.effectiveUkeireCount > compared.effectiveUkeireCount && preferred.goodShapeCount >= compared.goodShapeCount) {
    return '向听相同且好型不减时，优先保留当巡受入更宽的形。'
  }
  if (preferred.shanten === compared.shanten && preferred.goodShapeCount > compared.goodShapeCount && preferred.effectiveUkeireCount <= compared.effectiveUkeireCount) {
    return '这是速度与好型的取舍：保留更多真实两面进张，后续进听质量更稳定。'
  }
  return undefined
}
