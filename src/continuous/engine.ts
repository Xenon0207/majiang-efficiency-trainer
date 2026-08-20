import { normalizeTile, parseTiles, sortTiles, tileToIndex, toCounts, type TileCode, type TileInstance } from '../domain/tiles'
import {
  efficiencyBest,
  effectiveGoodShapeCount,
  effectiveUkeireCount,
  evaluateDiscards,
  evaluateShapeQuality,
  isDiscardFuriten,
  retainedDoraCount,
  retainedValuePotential,
  type DiscardEvaluation,
  type ShapeQuality,
} from '../solver/evaluate'
import { calculateShanten, calculateUkeire, type ShantenOptions } from '../solver/shanten'
import type { ContinuousSession } from './types'

interface ContinuousTurnBase {
  turn: number
  beforeHand: TileCode[]
  bestDiscards: TileCode[]
  recommendedKans: TileCode[]
  kanCandidates: KanEvaluation[]
  best: DiscardEvaluation
  candidates: DiscardEvaluation[]
  optimal: boolean
  drawnTile?: TileCode
}

export interface ContinuousDiscardTurn extends ContinuousTurnBase {
  action: 'discard'
  discard: TileCode
  chosen: DiscardEvaluation
}

export interface KanEvaluation extends ShapeQuality {
  tile: TileCode
  shanten: number
  ukeireTiles: TileCode[]
  ukeireCount: number
  effectiveUkeireCount: number
  furiten: boolean
  byTile: Record<string, number>
  retainedDora: number
  retainedYakuPotential: number
  standardShanten?: number
  standardUkeireCount?: number
  speedScore?: number
  speedDepth?: number
  nextUkeireExpectation?: number
}

export interface ContinuousKanTurn extends ContinuousTurnBase {
  action: 'kan'
  kanTile: TileCode
  chosen: KanEvaluation
  revealedDora?: TileCode
}

export type ContinuousTurn = ContinuousDiscardTurn | ContinuousKanTurn

export interface ContinuousState {
  hand: TileInstance[]
  nextWallIndex: number
  lastDrawId: string | null
  discards: TileCode[]
  declaredKans: TileCode[]
  doraIndicators: TileCode[]
  history: ContinuousTurn[]
  optimalTurns: number
  complete: boolean
}

function instances(codes: readonly TileCode[]): TileInstance[] {
  return parseTiles(codes.join(''))
}

export function visibleCounts(
  hand: readonly TileInstance[],
  discards: readonly TileCode[],
  doraIndicators: TileCode | readonly TileCode[],
  declaredKans: readonly TileCode[] = [],
): number[] {
  const counts = toCounts(hand)
  for (const tile of discards) counts[tileToIndex(normalizeTile(tile))] += 1
  const indicators = Array.isArray(doraIndicators) ? doraIndicators : [doraIndicators]
  for (const tile of indicators) counts[tileToIndex(normalizeTile(tile))] += 1
  for (const tile of declaredKans) counts[tileToIndex(normalizeTile(tile))] += 4
  return counts
}

export function continuousShantenOptions(state: ContinuousState): ShantenOptions {
  const fixedMelds = state.declaredKans.length
  return {
    includeChiitoi: fixedMelds === 0,
    includeKokushi: fixedMelds === 0,
    fixedMelds,
  }
}

export function startContinuousSession(session: ContinuousSession): ContinuousState {
  const firstDraw = session.wall[0]
  const hand = sortTiles(instances([...session.initialTiles, firstDraw]), session.suitOrder, session.dragonOrder)
  const drawn = hand.find((tile) => tile.code === firstDraw && hand.filter((item) => item.code === firstDraw).at(-1)?.id === tile.id)
  return {
    hand,
    nextWallIndex: 1,
    lastDrawId: drawn?.id ?? null,
    discards: [],
    declaredKans: [],
    doraIndicators: [session.context.doraIndicator],
    history: [],
    optimalTurns: 0,
    complete: false,
  }
}

export function evaluateContinuousState(state: ContinuousState, session: ContinuousSession): DiscardEvaluation[] {
  const valueTiles: TileCode[] = [session.context.roundWind, session.context.seatWind, '5z', '6z', '7z']
  return evaluateDiscards(
    state.hand,
    state.doraIndicators,
    continuousShantenOptions(state),
    visibleCounts(state.hand, state.discards, state.doraIndicators, state.declaredKans),
    valueTiles,
    true,
    state.discards,
  )
}

function compareActionQuality(a: Pick<DiscardEvaluation, 'shanten' | 'effectiveUkeireCount' | 'goodShapeCount' | 'furiten' | 'retainedDora' | 'retainedYakuPotential'>, b: Pick<DiscardEvaluation, 'shanten' | 'effectiveUkeireCount' | 'goodShapeCount' | 'furiten' | 'retainedDora' | 'retainedYakuPotential'>): number {
  return a.shanten - b.shanten ||
    b.effectiveUkeireCount - a.effectiveUkeireCount ||
    effectiveGoodShapeCount(b.goodShapeCount, b.furiten) - effectiveGoodShapeCount(a.goodShapeCount, a.furiten) ||
    b.retainedDora - a.retainedDora ||
    b.retainedYakuPotential - a.retainedYakuPotential
}

export function evaluateKanOptions(state: ContinuousState, session: ContinuousSession): KanEvaluation[] {
  if (state.complete || state.nextWallIndex + 1 >= session.wall.length || state.declaredKans.length >= 4) return []
  const byTile = new Map<TileCode, TileInstance[]>()
  for (const tile of state.hand) {
    const values = byTile.get(tile.normalized) ?? []
    values.push(tile)
    byTile.set(tile.normalized, values)
  }
  const indicators = state.doraIndicators
  const valueTiles: TileCode[] = [session.context.roundWind, session.context.seatWind, '5z', '6z', '7z']
  const visible = visibleCounts(state.hand, state.discards, indicators, state.declaredKans)
  const options: KanEvaluation[] = []

  for (const [tile, copies] of byTile) {
    if (copies.length !== 4) continue
    const remaining = state.hand.filter((item) => item.normalized !== tile)
    const counts = toCounts(remaining)
    const shantenOptions: ShantenOptions = { fixedMelds: state.declaredKans.length + 1 }
    const ukeire = calculateUkeire(counts, shantenOptions, visible)
    const furiten = isDiscardFuriten(counts, shantenOptions, state.discards, ukeire.shanten)
    const shape = evaluateShapeQuality(counts, ukeire, shantenOptions, visible)
    options.push({
      tile,
      shanten: calculateShanten(counts, shantenOptions),
      ukeireTiles: ukeire.tiles,
      ukeireCount: ukeire.count,
      effectiveUkeireCount: effectiveUkeireCount(ukeire.count, furiten),
      furiten,
      byTile: ukeire.byTile,
      retainedDora: retainedDoraCount(state.hand, indicators),
      retainedYakuPotential: retainedValuePotential(state.hand, valueTiles),
      ...shape,
    })
  }
  return options.sort(compareActionQuality)
}

function bestActions(state: ContinuousState, session: ContinuousSession, discards: readonly DiscardEvaluation[]) {
  const bestDiscard = discards[0]
  const kans = evaluateKanOptions(state, session)
  const all = [
    ...efficiencyBest(discards).map((value) => ({ type: 'discard' as const, value })),
    ...kans.map((value) => ({ type: 'kan' as const, value })),
  ].sort((a, b) => compareActionQuality(a.value, b.value) || (a.type === b.type ? 0 : a.type === 'kan' ? -1 : 1))
  const best = all[0]
  return {
    bestDiscard,
    kans,
    bestDiscards: best.type === 'discard'
      ? efficiencyBest(discards).filter((value) => compareActionQuality(value, best.value) === 0).map((value) => value.discard)
      : [],
    recommendedKans: best.type === 'kan'
      ? kans.filter((value) => compareActionQuality(value, best.value) === 0).map((value) => value.tile)
      : [],
  }
}

export function discardAndDraw(state: ContinuousState, session: ContinuousSession, discardId: string): ContinuousState {
  if (state.complete) return state
  const tile = state.hand.find((item) => item.id === discardId)
  if (!tile) throw new Error(`手牌中找不到要切的牌：${discardId}`)
  const evaluations = evaluateContinuousState(state, session)
  const chosen = evaluations.find((item) => item.discard === tile.code)
  if (!chosen) throw new Error(`没有切牌评价：${tile.code}`)
  const { bestDiscard: best, bestDiscards, recommendedKans, kans } = bestActions(state, session, evaluations)
  const optimal = bestDiscards.includes(tile.code)
  const remainingCodes = state.hand.filter((item) => item.id !== discardId).map((item) => item.code)
  const tenpai = chosen.shanten <= 0 && chosen.ukeireCount > 0
  const wallEmpty = state.nextWallIndex >= session.wall.length
  const complete = tenpai || wallEmpty
  const drawnTile = complete ? undefined : session.wall[state.nextWallIndex]
  const nextCodes = drawnTile ? [...remainingCodes, drawnTile] : remainingCodes
  const nextHand = sortTiles(instances(nextCodes), session.suitOrder, session.dragonOrder)
  const drawnInstance = drawnTile
    ? [...nextHand].reverse().find((item) => item.code === drawnTile)
    : undefined
  const turn: ContinuousTurn = {
    turn: state.history.length + 1,
    action: 'discard',
    beforeHand: state.hand.map((item) => item.code),
    discard: tile.code,
    bestDiscards,
    recommendedKans,
    kanCandidates: kans,
    chosen,
    best,
    candidates: evaluations,
    optimal,
    drawnTile,
  }

  return {
    ...state,
    hand: nextHand,
    nextWallIndex: state.nextWallIndex + Number(Boolean(drawnTile)),
    lastDrawId: drawnInstance?.id ?? null,
    discards: [...state.discards, tile.code],
    history: [...state.history, turn],
    optimalTurns: state.optimalTurns + Number(optimal),
    complete,
  }
}

export function declareKan(state: ContinuousState, session: ContinuousSession, tileCode: TileCode): ContinuousState {
  if (state.complete) return state
  const evaluations = evaluateContinuousState(state, session)
  const { bestDiscard: best, bestDiscards, recommendedKans, kans } = bestActions(state, session, evaluations)
  const chosen = kans.find((value) => value.tile === normalizeTile(tileCode))
  if (!chosen) throw new Error(`当前不能暗杠：${tileCode}`)
  const optimal = recommendedKans.includes(chosen.tile)
  const revealedDora = session.wall[state.nextWallIndex]
  const drawnTile = session.wall[state.nextWallIndex + 1]
  const remainingCodes = state.hand.filter((tile) => tile.normalized !== chosen.tile).map((tile) => tile.code)
  const nextHand = sortTiles(instances([...remainingCodes, drawnTile]), session.suitOrder, session.dragonOrder)
  const drawnInstance = [...nextHand].reverse().find((tile) => tile.code === drawnTile)
  const turn: ContinuousKanTurn = {
    turn: state.history.length + 1,
    action: 'kan',
    beforeHand: state.hand.map((tile) => tile.code),
    kanTile: chosen.tile,
    bestDiscards,
    recommendedKans,
    kanCandidates: kans,
    chosen,
    best,
    candidates: evaluations,
    optimal,
    revealedDora,
    drawnTile,
  }
  return {
    ...state,
    hand: nextHand,
    nextWallIndex: state.nextWallIndex + 2,
    lastDrawId: drawnInstance?.id ?? null,
    declaredKans: [...state.declaredKans, chosen.tile],
    doraIndicators: [...state.doraIndicators, revealedDora],
    history: [...state.history, turn],
    optimalTurns: state.optimalTurns + Number(optimal),
  }
}

export function optimalChoicePercent(state: Pick<ContinuousState, 'history' | 'optimalTurns'>): number {
  if (state.history.length === 0) return 0
  return Math.round(state.optimalTurns / state.history.length * 1000) / 10
}
