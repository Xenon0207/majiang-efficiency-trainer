import { indexToTile, tileToIndex, type Suit, type TileCode } from '../domain/tiles'
import { calculateRouteShanten, calculateShanten, type RouteShanten, type ShantenOptions, type UkeireResult } from './shanten'

export type ShapeTransitionKind = 'advance' | 'improvement'
export type ShapeTransitionReason = 'existing-ryanmen' | 'creates-ryanmen' | 'local-frontier' | 'route-upgrade' | 'lower-shanten'

export interface ShapeTransitionFact {
  tile: TileCode
  remaining: number
  kind: ShapeTransitionKind
  good: boolean
  reasons: ShapeTransitionReason[]
  /** 降向听后的推荐整理切牌，或保留本次改良时可采用的再切。听牌和了牌没有再切。 */
  bestDiscard?: TileCode
}

export interface ShapeTransitionAnalysis {
  goodShapeTiles: TileCode[]
  badShapeTiles: TileCode[]
  improvementTiles: TileCode[]
  goodImprovementTiles: TileCode[]
  shapeByTile: Record<string, number>
  goodShapeCount: number
  qualityCalculated: boolean
  transitions: ShapeTransitionFact[]
}

export interface LocalShapeVector {
  melds: number
  pairs: number
  ryanmen: number
  otherTaatsu: number
  groupedTiles: number
  ryanmenWaits: number[]
  /** 该分割所有对子、两面、嵌张与边张的理论完成牌。 */
  effectiveWaits: number[]
}

export interface LocalShapeProfile {
  frontier: LocalShapeVector[]
  ryanmenWaits: number[]
  maxRyanmen: number
}

interface MutableLocalVector {
  melds: number
  pairs: number
  ryanmen: number
  otherTaatsu: number
  ryanmenWaits: Set<number>
  effectiveWaits: Set<number>
}

const NUMBER_SUITS: readonly Suit[] = ['m', 'p', 's']
const localProfileCache = new Map<string, LocalShapeProfile>()

function vectorKey(value: LocalShapeVector): string {
  return `${value.melds}/${value.pairs}/${value.ryanmen}/${value.otherTaatsu}/${value.ryanmenWaits.join(',')}/${value.effectiveWaits.join(',')}`
}

function dimensions(value: LocalShapeVector): number[] {
  const blocks = value.pairs + value.ryanmen + value.otherTaatsu
  // 2/1 的单位直接来自普通手向听公式，不使用经验权重。
  const progressUnits = value.melds * 2 + blocks
  return [progressUnits, value.melds, blocks, value.ryanmen, value.pairs, value.groupedTiles]
}

function weaklyDominates(left: LocalShapeVector, right: LocalShapeVector): boolean {
  const a = dimensions(left)
  const b = dimensions(right)
  const waits = new Set(left.effectiveWaits)
  return a.every((value, index) => value >= b[index]) && right.effectiveWaits.every((rank) => waits.has(rank))
}

function strictlyDominates(left: LocalShapeVector, right: LocalShapeVector): boolean {
  const a = dimensions(left)
  const b = dimensions(right)
  const waits = new Set(left.effectiveWaits)
  const coversWaits = right.effectiveWaits.every((rank) => waits.has(rank))
  const addsWait = left.effectiveWaits.some((rank) => !right.effectiveWaits.includes(rank))
  return coversWaits && a.every((value, index) => value >= b[index]) && (addsWait || a.some((value, index) => value > b[index]))
}

function firstOccupied(counts: readonly number[]): number {
  return counts.findIndex((count) => count > 0)
}

/**
 * 枚举一门牌的所有互斥面子/对子/搭子分割，再只保留不被全面压过的结构前沿。
 * 浮牌由“跳过一张”自然留下；前沿不会像 UI 分组那样截断为固定数量。
 */
export function analyzeLocalShape(rankCounts: readonly number[], suit: Suit): LocalShapeProfile {
  const key = `${suit}:${rankCounts.join('')}`
  const cached = localProfileCache.get(key)
  if (cached) return cached

  const counts = [...rankCounts]
  const deduped = new Map<string, LocalShapeVector>()

  function visit(state: MutableLocalVector) {
    const index = firstOccupied(counts)
    if (index < 0) {
      const waits = [...state.ryanmenWaits].sort((a, b) => a - b)
      const effectiveWaits = [...state.effectiveWaits].sort((a, b) => a - b)
      const value: LocalShapeVector = {
        melds: state.melds,
        pairs: state.pairs,
        ryanmen: state.ryanmen,
        otherTaatsu: state.otherTaatsu,
        groupedTiles: state.melds * 3 + (state.pairs + state.ryanmen + state.otherTaatsu) * 2,
        ryanmenWaits: waits,
        effectiveWaits,
      }
      deduped.set(vectorKey(value), value)
      return
    }

    // 当前牌作为浮牌，不参与这一个分割。
    counts[index] -= 1
    visit(state)
    counts[index] += 1

    if (counts[index] >= 3) {
      counts[index] -= 3
      visit({ ...state, melds: state.melds + 1 })
      counts[index] += 3
    }

    if (suit !== 'z' && index <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      counts[index + 2] -= 1
      visit({ ...state, melds: state.melds + 1 })
      counts[index] += 1
      counts[index + 1] += 1
      counts[index + 2] += 1
    }

    if (counts[index] >= 2) {
      counts[index] -= 2
      const waits = new Set(state.effectiveWaits)
      waits.add(index + 1)
      visit({ ...state, pairs: state.pairs + 1, effectiveWaits: waits })
      counts[index] += 2
    }

    if (suit !== 'z' && index <= 7 && counts[index + 1] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      const leftRank = index + 1
      if (leftRank >= 2 && leftRank <= 7) {
        const waits = new Set(state.ryanmenWaits)
        const effectiveWaits = new Set(state.effectiveWaits)
        waits.add(leftRank - 1)
        waits.add(leftRank + 2)
        effectiveWaits.add(leftRank - 1)
        effectiveWaits.add(leftRank + 2)
        visit({ ...state, ryanmen: state.ryanmen + 1, ryanmenWaits: waits, effectiveWaits })
      } else {
        const effectiveWaits = new Set(state.effectiveWaits)
        effectiveWaits.add(leftRank === 1 ? 3 : 7)
        visit({ ...state, otherTaatsu: state.otherTaatsu + 1, effectiveWaits })
      }
      counts[index] += 1
      counts[index + 1] += 1
    }

    if (suit !== 'z' && index <= 6 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 2] -= 1
      const effectiveWaits = new Set(state.effectiveWaits)
      effectiveWaits.add(index + 2)
      visit({ ...state, otherTaatsu: state.otherTaatsu + 1, effectiveWaits })
      counts[index] += 1
      counts[index + 2] += 1
    }
  }

  visit({ melds: 0, pairs: 0, ryanmen: 0, otherTaatsu: 0, ryanmenWaits: new Set<number>(), effectiveWaits: new Set<number>() })
  const all = [...deduped.values()]
  const frontier = all.filter((candidate, candidateIndex) =>
    !all.some((other, otherIndex) => otherIndex !== candidateIndex && strictlyDominates(other, candidate)),
  )
  const ryanmenWaits = [...new Set(frontier.flatMap((value) => value.ryanmenWaits))].sort((a, b) => a - b)
  const profile = { frontier, ryanmenWaits, maxRyanmen: Math.max(0, ...frontier.map((value) => value.ryanmen)) }
  localProfileCache.set(key, profile)
  return profile
}

function suitForIndex(index: number): { suit: Suit; start: number; length: number; rank: number } {
  if (index < 27) {
    const suitIndex = Math.floor(index / 9)
    return { suit: NUMBER_SUITS[suitIndex], start: suitIndex * 9, length: 9, rank: index % 9 + 1 }
  }
  return { suit: 'z', start: 27, length: 7, rank: index - 27 + 1 }
}

function localProfileAt(counts: readonly number[], tileIndex: number): LocalShapeProfile {
  const { suit, start, length } = suitForIndex(tileIndex)
  return analyzeLocalShape(counts.slice(start, start + length), suit)
}

function offersNewStructure(before: LocalShapeProfile, after: LocalShapeProfile): boolean {
  return after.frontier.some((candidate) => !before.frontier.some((baseline) => weaklyDominates(baseline, candidate)))
}

function addsRyanmenOption(before: LocalShapeProfile, after: LocalShapeProfile): boolean {
  const existing = new Set(before.ryanmenWaits)
  return after.maxRyanmen > before.maxRyanmen || after.ryanmenWaits.some((rank) => !existing.has(rank))
}

function routeUpgrade(before: RouteShanten, after: RouteShanten): boolean {
  // 只保留已经进入最低向听后一档以内的可转换路线；远处国士每摸一张幺九都不应污染普通手改良列表。
  const relevantLimit = before.minimum + 1
  return (after.standard < before.standard && after.standard <= relevantLimit) ||
    (after.chiitoi < before.chiitoi && after.chiitoi <= relevantLimit) ||
    (after.kokushi < before.kokushi && after.kokushi <= relevantLimit)
}

function sameCounts(left: readonly number[], right: readonly number[]): boolean {
  return left.every((count, index) => count === right[index])
}

function cachedShanten(counts: readonly number[], options: ShantenOptions, cache: Map<string, number>): number {
  const key = counts.join('')
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const value = calculateShanten(counts, options)
  cache.set(key, value)
  return value
}

function cachedRoutes(counts: readonly number[], fixedMelds: number, cache: Map<string, RouteShanten>): RouteShanten {
  const key = counts.join('')
  const cached = cache.get(key)
  if (cached) return cached
  const value = calculateRouteShanten(counts, fixedMelds)
  cache.set(key, value)
  return value
}

/**
 * 为一手切牌后的 13 张牌建立统一摸牌事实表。
 * “降向听”“改良”“好型”都从这张表导出，不再由互不相干的启发式列表分别猜测。
 */
export function analyzeShapeTransitions(
  counts: readonly number[],
  ukeire: UkeireResult,
  options: ShantenOptions,
  visible: readonly number[],
  excludedImprovementTile?: TileCode,
): ShapeTransitionAnalysis {
  const strictIndices = new Set(ukeire.tiles.map(tileToIndex))
  const excludedIndex = excludedImprovementTile === undefined ? -1 : tileToIndex(excludedImprovementTile)
  const baselineRoutes = calculateRouteShanten(counts, options.fixedMelds ?? 0)
  const shantenCache = new Map<string, number>()
  const routeCache = new Map<string, RouteShanten>()
  const transitions: ShapeTransitionFact[] = []
  const shapeByTile: Record<string, number> = { ...ukeire.byTile }

  for (let drawIndex = 0; drawIndex < 34; drawIndex += 1) {
    const remaining = Math.max(0, 4 - visible[drawIndex])
    if (remaining === 0 || counts[drawIndex] >= 4) continue
    const tile = indexToTile(drawIndex)
    const strict = strictIndices.has(drawIndex)
    const beforeLocal = localProfileAt(counts, drawIndex)
    const directRyanmen = drawIndex < 27 && beforeLocal.ryanmenWaits.includes(suitForIndex(drawIndex).rank)
    const withDraw = [...counts]
    withDraw[drawIndex] += 1
    const withDrawLocal = localProfileAt(withDraw, drawIndex)
    // 听牌后的和了牌只按原本待牌形状判断；不能把完成顺子重新拆成另一组两面来冒充好型。
    const createsRyanmenBeforeDiscard = ukeire.shanten > 0 && drawIndex < 27 && addsRyanmenOption(beforeLocal, withDrawLocal)

    if (strict) {
      const reasons: ShapeTransitionReason[] = ['lower-shanten']
      if (directRyanmen) reasons.push('existing-ryanmen')
      let bestDiscard: TileCode | undefined
      let createsRyanmen = createsRyanmenBeforeDiscard
      // 听牌摸到和了牌时无需再切；其余降向听进张保留一份可解释的再切证据。
      if (ukeire.shanten > 0) {
        const targetShanten = ukeire.shanten - 1
        for (let discardIndex = 0; discardIndex < 34; discardIndex += 1) {
          if (withDraw[discardIndex] <= 0) continue
          const afterDiscard = [...withDraw]
          afterDiscard[discardIndex] -= 1
          if (cachedShanten(afterDiscard, options, shantenCache) !== targetShanten) continue
          bestDiscard ??= indexToTile(discardIndex)
          if (drawIndex < 27 && addsRyanmenOption(beforeLocal, localProfileAt(afterDiscard, drawIndex))) createsRyanmen = true
          if (createsRyanmen && bestDiscard) break
        }
      }
      if (createsRyanmen && !directRyanmen) reasons.push('creates-ryanmen')
      transitions.push({ tile, remaining, kind: 'advance', good: directRyanmen || createsRyanmen, reasons, bestDiscard })
      continue
    }

    if (ukeire.shanten <= 0 || drawIndex === excludedIndex) continue
    const localPotential = offersNewStructure(beforeLocal, withDrawLocal)
    const routePotential = routeUpgrade(baselineRoutes, cachedRoutes(withDraw, options.fixedMelds ?? 0, routeCache))
    if (!localPotential && !routePotential) continue

    let bestDiscard: TileCode | undefined
    let localImprovement = false
    let preservedRouteUpgrade = false
    let createsRyanmen = false
    for (let discardIndex = 0; discardIndex < 34; discardIndex += 1) {
      if (withDraw[discardIndex] <= 0) continue
      const afterDiscard = [...withDraw]
      afterDiscard[discardIndex] -= 1
      // 摸回后原样摸切不构成改良，也不会反向奖励刚切出的牌。
      if (sameCounts(afterDiscard, counts)) continue
      if (cachedShanten(afterDiscard, options, shantenCache) !== ukeire.shanten) continue
      const afterLocal = localProfileAt(afterDiscard, drawIndex)
      const improvesLocal = offersNewStructure(beforeLocal, afterLocal)
      const improvesRoute = routeUpgrade(baselineRoutes, cachedRoutes(afterDiscard, options.fixedMelds ?? 0, routeCache))
      if (!improvesLocal && !improvesRoute) continue
      bestDiscard ??= indexToTile(discardIndex)
      localImprovement ||= improvesLocal
      preservedRouteUpgrade ||= improvesRoute
      createsRyanmen ||= drawIndex < 27 && addsRyanmenOption(beforeLocal, afterLocal)
      if (createsRyanmen && localImprovement && (!routePotential || preservedRouteUpgrade)) break
    }
    if (!bestDiscard) continue

    const reasons: ShapeTransitionReason[] = []
    if (localImprovement) reasons.push('local-frontier')
    if (preservedRouteUpgrade) reasons.push('route-upgrade')
    if (directRyanmen) reasons.push('existing-ryanmen')
    if (createsRyanmen && !directRyanmen) reasons.push('creates-ryanmen')
    shapeByTile[tile] = remaining
    transitions.push({ tile, remaining, kind: 'improvement', good: directRyanmen || createsRyanmen, reasons, bestDiscard })
  }

  const advances = transitions.filter((value) => value.kind === 'advance')
  const improvements = transitions.filter((value) => value.kind === 'improvement')
  const goodShapeTiles = advances.filter((value) => value.good).map((value) => value.tile)
  const badShapeTiles = advances.filter((value) => !value.good).map((value) => value.tile)
  const improvementTiles = improvements.map((value) => value.tile)
  const goodImprovementTiles = improvements.filter((value) => value.good).map((value) => value.tile)
  const goodTiles = new Set([...goodShapeTiles, ...goodImprovementTiles])
  const goodShapeCount = transitions.reduce((sum, value) => sum + (goodTiles.has(value.tile) ? value.remaining : 0), 0)

  return {
    goodShapeTiles,
    badShapeTiles,
    improvementTiles,
    goodImprovementTiles,
    shapeByTile,
    goodShapeCount,
    qualityCalculated: true,
    transitions,
  }
}
