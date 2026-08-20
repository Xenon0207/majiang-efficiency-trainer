import { doraFromIndicator, indexToTile, normalizeTile, toCounts, type TileCode, type TileInstance } from '../domain/tiles'
import { calculateRouteShanten, calculateShanten, calculateUkeire, type ShantenOptions, type UkeireResult } from './shanten'
import { analyzeShapeTransitions, type ShapeTransitionFact } from './shape-transitions'

export interface DiscardEvaluation {
  discard: TileCode
  shanten: number
  ukeireTiles: TileCode[]
  ukeireCount: number
  /** 考虑舍牌振听后用于排序的有效受入；整组振听待牌统一按 1/4 计。 */
  effectiveUkeireCount: number
  /** 自己的牌河命中当前完整理论待牌集合中的任意一张时为 true。 */
  furiten: boolean
  byTile: Record<string, number>
  retainedDora: number
  retainedYakuPotential: number
  standardShanten: number
  standardUkeireCount: number
  goodShapeTiles: TileCode[]
  badShapeTiles: TileCode[]
  improvementTiles: TileCode[]
  goodImprovementTiles: TileCode[]
  shapeByTile: Record<string, number>
  goodShapeCount: number
  qualityCalculated: boolean
  transitions: ShapeTransitionFact[]
  /**
   * 2.0 纯速度值：有限巡内累计降低的期望向听数，越大表示越早、越频繁地推进。
   * 和牌按 -1 向听的吸收状态计入，因此真实两面最终会通过更宽的成和机会自然增值。
   */
  speedScore?: number
  /** 本次速度值实际观察的摸牌巡数。 */
  speedDepth?: number
  /** 枚举下一次摸牌与最佳再切所得的加权平均受入；作为教学解释展示，不再直接决定排序。 */
  nextUkeireExpectation?: number
}

export interface ShapeQuality {
  goodShapeTiles: TileCode[]
  badShapeTiles: TileCode[]
  improvementTiles: TileCode[]
  goodImprovementTiles: TileCode[]
  shapeByTile: Record<string, number>
  goodShapeCount: number
  qualityCalculated: boolean
  transitions: ShapeTransitionFact[]
}

interface NextStateScore {
  shanten: number
  effectiveUkeireCount: number
}

interface ProgressSearchContext {
  options: ShantenOptions
  memo: Map<string, number>
}

export const FURITEN_UKEIRE_WEIGHT = 0.25

/**
 * 2.0 使用统一的两巡窗口：一向听可以直接观察“进听 → 成和”，其余阶段观察
 * “直接推进 → 改良后的下一巡推进”。更长的三至四巡分布留给3.0，避免手机端每切一牌等待整棵树。
 */
export function speedDepthForShanten(shanten: number): number {
  if (shanten <= 0) return 1
  return 2
}

function ownRiverKey(ownDiscards: readonly TileCode[]): string {
  return [...new Set(ownDiscards.map(normalizeTile))].sort().join(',')
}

/**
 * 舍牌振听看的是完整理论待牌，而不是只看仍有剩余枚数的受入。
 * 因此 23 等 14 时，只要自己的牌河里有 1，1 与 4 整组都属于振听。
 */
export function isDiscardFuriten(
  counts: readonly number[],
  options: ShantenOptions,
  ownDiscards: readonly TileCode[],
  shanten = calculateShanten(counts, options),
): boolean {
  if (shanten !== 0 || ownDiscards.length === 0) return false
  const ownRiver = new Set(ownDiscards.map(normalizeTile))
  const theoreticalWaits = calculateUkeire(counts, options).tiles
  return theoreticalWaits.some((tile) => ownRiver.has(normalizeTile(tile)))
}

export function effectiveUkeireCount(ukeireCount: number, furiten: boolean): number {
  return Math.round(ukeireCount * (furiten ? FURITEN_UKEIRE_WEIGHT : 1) * 100) / 100
}

export function effectiveGoodShapeCount(goodShapeCount: number, furiten: boolean): number {
  return Math.round(goodShapeCount * (furiten ? FURITEN_UKEIRE_WEIGHT : 1) * 100) / 100
}

function nextStateScore(
  counts: readonly number[],
  options: ShantenOptions,
  visible: readonly number[],
  memo: Map<string, NextStateScore>,
  ownDiscards: readonly TileCode[],
): NextStateScore {
  const key = `${counts.join('')}|${visible.join('')}|${ownRiverKey(ownDiscards)}`
  const cached = memo.get(key)
  if (cached) return cached
  const ukeire = calculateUkeire(counts, options, visible)
  const furiten = isDiscardFuriten(counts, options, ownDiscards, ukeire.shanten)
  const score = { shanten: ukeire.shanten, effectiveUkeireCount: effectiveUkeireCount(ukeire.count, furiten) }
  memo.set(key, score)
  return score
}

/**
 * 枚举下一张摸牌；对每种摸牌选择向听最低、受入最多的再切，按剩余枚数加权。
 * 无效摸牌可以原样摸切，因此也会保留当前受入；有效进张则使用进张后新阶段的受入。
 */
export function calculateExpectedNextUkeire(
  counts: readonly number[],
  options: ShantenOptions,
  visible: readonly number[],
  memo = new Map<string, NextStateScore>(),
  ownDiscards: readonly TileCode[] = [],
): number {
  let totalRemaining = 0
  let weightedUkeire = 0

  for (let drawIndex = 0; drawIndex < 34; drawIndex += 1) {
    const remainingCopies = Math.max(0, 4 - visible[drawIndex])
    if (remainingCopies === 0 || counts[drawIndex] >= 4) continue
    const withDraw = [...counts]
    withDraw[drawIndex] += 1
    const visibleAfterDraw = [...visible]
    visibleAfterDraw[drawIndex] += 1
    let best: NextStateScore | undefined

    for (let discardIndex = 0; discardIndex < 34; discardIndex += 1) {
      if (withDraw[discardIndex] <= 0) continue
      const afterDiscard = [...withDraw]
      afterDiscard[discardIndex] -= 1
      const score = nextStateScore(afterDiscard, options, visibleAfterDraw, memo, [...ownDiscards, indexToTile(discardIndex)])
      if (!best || score.shanten < best.shanten || (score.shanten === best.shanten && score.effectiveUkeireCount > best.effectiveUkeireCount)) best = score
    }

    if (!best) continue
    totalRemaining += remainingCopies
    weightedUkeire += remainingCopies * best.effectiveUkeireCount
  }

  return totalRemaining > 0 ? Math.round(weightedUkeire / totalRemaining * 10) / 10 : 0
}

function progressMemoKey(
  counts: readonly number[],
  visible: readonly number[],
  ownDiscards: readonly TileCode[],
  depth: number,
): string {
  return `${depth}|${counts.join('')}|${visible.join('')}|${ownRiverKey(ownDiscards)}`
}

/**
 * 从一副 13 张状态出发，计算未来若干巡的期望 `-向听数` 面积。
 * 每次摸牌后先硬性筛掉退向听切法，再从最低向听分支中选择后续推进值最大的动作。
 * 和牌是 -1 向听的吸收状态：越早和牌，余下巡数都会继续获得完成奖励。
 */
function expectedNegativeShantenArea(
  counts: readonly number[],
  visible: readonly number[],
  ownDiscards: readonly TileCode[],
  depth: number,
  context: ProgressSearchContext,
  excludedFirstDraw?: TileCode,
): number {
  if (depth <= 0) return 0
  const memoKey = excludedFirstDraw
    ? undefined
    : progressMemoKey(counts, visible, ownDiscards, depth)
  if (memoKey) {
    const cached = context.memo.get(memoKey)
    if (cached !== undefined) return cached
  }

  const currentShanten = calculateShanten(counts, context.options)
  const currentFuriten = isDiscardFuriten(counts, context.options, ownDiscards, currentShanten)
  const excludedNormalized = excludedFirstDraw ? normalizeTile(excludedFirstDraw) : undefined

  // 最后一巡无需再枚举“摸牌后切什么”：有效进张必然令向听下降一，其余牌可以原样摸切。
  // 这与完整枚举的结果相同，却省去 34×候选切牌的最后一层搜索。
  if (depth === 1) {
    const ukeire = calculateUkeire(counts, context.options, visible)
    let progressCopies = effectiveUkeireCount(ukeire.count, currentFuriten)
    if (excludedNormalized) {
      const excludedCopies = ukeire.byTile[excludedNormalized] ?? 0
      progressCopies -= excludedCopies * (currentFuriten ? FURITEN_UKEIRE_WEIGHT : 1)
    }
    let totalRemaining = 0
    for (let index = 0; index < 34; index += 1) {
      if (counts[index] < 4) totalRemaining += Math.max(0, 4 - visible[index])
    }
    const result = -currentShanten + (totalRemaining > 0 ? progressCopies / totalRemaining : 0)
    if (memoKey) context.memo.set(memoKey, result)
    return result
  }

  let totalRemaining = 0
  let weightedArea = 0

  for (let drawIndex = 0; drawIndex < 34; drawIndex += 1) {
    const remainingCopies = Math.max(0, 4 - visible[drawIndex])
    if (remainingCopies === 0 || counts[drawIndex] >= 4) continue
    const drawTile = indexToTile(drawIndex)
    const withDraw = [...counts]
    withDraw[drawIndex] += 1
    const visibleAfterDraw = [...visible]
    visibleAfterDraw[drawIndex] += 1
    totalRemaining += remainingCopies

    // 摸回本巡刚切的牌只恢复原状，不允许借此反向奖励这次切牌；强制原样摸切后继续。
    if (excludedNormalized && drawTile === excludedNormalized) {
      const neutralArea = -currentShanten + expectedNegativeShantenArea(
        counts,
        visibleAfterDraw,
        ownDiscards,
        depth - 1,
        context,
      )
      weightedArea += remainingCopies * neutralArea
      continue
    }

    const drawnShanten = calculateShanten(withDraw, context.options)
    if (drawnShanten < 0) {
      if (!currentFuriten) {
        weightedArea += remainingCopies * depth
      } else {
        // 振听等待只有通常 1/4 的有效成和机会；其余机会按本巡未推进处理。
        const missedArea = -currentShanten + expectedNegativeShantenArea(
          counts,
          visibleAfterDraw,
          ownDiscards,
          depth - 1,
          context,
        )
        weightedArea += remainingCopies * (FURITEN_UKEIRE_WEIGHT * depth + (1 - FURITEN_UKEIRE_WEIGHT) * missedArea)
      }
      continue
    }

    let minimumAfterShanten = Number.POSITIVE_INFINITY
    const nextStates: Array<{ counts: number[]; discard: TileCode; shanten: number }> = []
    for (let discardIndex = 0; discardIndex < 34; discardIndex += 1) {
      if (withDraw[discardIndex] <= 0) continue
      const afterDiscard = [...withDraw]
      afterDiscard[discardIndex] -= 1
      const shanten = calculateShanten(afterDiscard, context.options)
      if (shanten < minimumAfterShanten) minimumAfterShanten = shanten
      nextStates.push({ counts: afterDiscard, discard: indexToTile(discardIndex), shanten })
    }

    let chosenNext: { counts: number[]; discard: TileCode; shanten: number } | undefined
    let bestPreview = Number.NEGATIVE_INFINITY
    for (const next of nextStates) {
      // “向听数不退化”是每一层搜索的硬前置，而不只是根节点的排序规则。
      if (next.shanten !== minimumAfterShanten) continue
      // 用下一巡的精确推进概率选择动作，再沿该动作继续模拟剩余巡数。
      // 这保留了分层漏斗（最低向听 → 当巡速度 → 后续改良），避免三巡时对每个近似等价切牌
      // 都递归展开整棵子树；在两巡模型中该预览就是完整最优值。
      const preview = -next.shanten + expectedNegativeShantenArea(
        next.counts,
        visibleAfterDraw,
        [...ownDiscards, next.discard],
        1,
        context,
      )
      if (preview > bestPreview) {
        bestPreview = preview
        chosenNext = next
      }
    }
    if (chosenNext) {
      const bestBranch = -chosenNext.shanten + expectedNegativeShantenArea(
        chosenNext.counts,
        visibleAfterDraw,
        [...ownDiscards, chosenNext.discard],
        depth - 1,
        context,
      )
      weightedArea += remainingCopies * bestBranch
    }
  }

  const result = totalRemaining > 0 ? weightedArea / totalRemaining : -currentShanten * depth
  if (memoKey) context.memo.set(memoKey, result)
  return result
}

/**
 * 将期望 `-向听数` 面积换回“累计推进值”。0 表示观察期内完全没有推进；
 * 第一巡推进会在后续每一巡继续贡献，因而天然比同样发生在后一巡的推进更有价值。
 */
export function calculateProgressSpeed(
  counts: readonly number[],
  options: ShantenOptions,
  visible: readonly number[],
  ownDiscards: readonly TileCode[] = [],
  depth = speedDepthForShanten(calculateShanten(counts, options)),
  memo = new Map<string, number>(),
  excludedFirstDraw?: TileCode,
): number {
  const shanten = calculateShanten(counts, options)
  const negativeArea = expectedNegativeShantenArea(
    counts,
    visible,
    ownDiscards,
    depth,
    { options, memo },
    excludedFirstDraw,
  )
  return Math.round((depth * shanten + negativeArea) * 1000) / 1000
}

/** 所有形状事实统一来自逐门精确分割和 34 种摸牌转移表。 */
export function evaluateShapeQuality(
  counts: readonly number[],
  ukeire: UkeireResult,
  options: ShantenOptions,
  visible: readonly number[],
  excludedImprovementTile?: TileCode,
): ShapeQuality {
  return analyzeShapeTransitions(counts, ukeire, options, visible, excludedImprovementTile)
}

export function retainedDoraCount(tiles: readonly TileInstance[], indicators: readonly TileCode[]): number {
  const doraTiles = indicators.map(doraFromIndicator).map(normalizeTile)
  return tiles.reduce((sum, tile) => sum + Number(tile.red) + doraTiles.filter((dora) => dora === tile.normalized).length, 0)
}

export function retainedValuePotential(tiles: readonly TileInstance[], valueTiles: readonly TileCode[]): number {
  const valueTileSet = new Set(valueTiles.map(normalizeTile))
  const valueCounts = new Map<TileCode, number>()
  for (const kept of tiles) {
    if (!valueTileSet.has(kept.normalized)) continue
    valueCounts.set(kept.normalized, (valueCounts.get(kept.normalized) ?? 0) + 1)
  }
  // 单张役牌只是浮牌，不能在纯牌效同分时压过数牌的面子手改良；成对后才计入价值。
  return [...valueCounts.values()].reduce((sum, count) => sum + (count >= 3 ? 30 : count === 2 ? 8 : 0), 0)
}

export function evaluateDiscards(
  hand: readonly TileInstance[],
  doraIndicator: TileCode | readonly TileCode[],
  options: ShantenOptions = {},
  visibleCounts?: readonly number[],
  valueTiles: readonly TileCode[] = [],
  includeGoodShape = false,
  ownDiscards: readonly TileCode[] = [],
): DiscardEvaluation[] {
  const visible = visibleCounts ? [...visibleCounts] : toCounts(hand)
  const doraIndicators = Array.isArray(doraIndicator) ? doraIndicator : [doraIndicator]
  const seenChoices = new Set<string>()
  const evaluations: DiscardEvaluation[] = []
  const remainingCounts = new Map<string, number[]>()

  for (const tile of hand) {
    const choiceKey = tile.red ? tile.code : normalizeTile(tile.code)
    if (seenChoices.has(choiceKey)) continue
    seenChoices.add(choiceKey)
    const index = hand.findIndex((candidate) => candidate.id === tile.id)
    const remaining = [...hand.slice(0, index), ...hand.slice(index + 1)]
    const counts = toCounts(remaining)
    remainingCounts.set(choiceKey, counts)
    const shanten = calculateShanten(counts, options)
    const ukeire = calculateUkeire(counts, options, visible)
    const candidateRiver = [...ownDiscards, normalizeTile(tile.code)]
    const furiten = isDiscardFuriten(counts, options, candidateRiver, shanten)
    const shapeQuality = {
      goodShapeTiles: [] as TileCode[],
      badShapeTiles: [...ukeire.tiles],
      improvementTiles: [] as TileCode[],
      goodImprovementTiles: [] as TileCode[],
      shapeByTile: { ...ukeire.byTile },
      goodShapeCount: 0,
      qualityCalculated: false,
      transitions: [] as ShapeTransitionFact[],
    }
    const standardOptions: ShantenOptions = { fixedMelds: options.fixedMelds }
    const standardShanten = calculateRouteShanten(counts, options.fixedMelds ?? 0).standard
    const standardUkeireCount = calculateUkeire(counts, standardOptions, visible).count
    const retainedYakuPotential = retainedValuePotential(remaining, valueTiles)
    evaluations.push({
      discard: tile.code,
      shanten,
      ukeireTiles: ukeire.tiles,
      ukeireCount: ukeire.count,
      effectiveUkeireCount: effectiveUkeireCount(ukeire.count, furiten),
      furiten,
      byTile: ukeire.byTile,
      retainedDora: retainedDoraCount(remaining, doraIndicators),
      retainedYakuPotential,
      standardShanten,
      standardUkeireCount,
      ...shapeQuality,
    })
  }

  const minimumShanten = Math.min(...evaluations.map((value) => value.shanten))
  const sameShanten = evaluations.filter((value) => value.shanten === minimumShanten)
  if (includeGoodShape) {
    const memo = new Map<string, NextStateScore>()
    const progressMemo = new Map<string, number>()
    // 向听同档候选全部计算次巡期望；速度来自分门向听缓存，而不是隐藏非最优候选的数据。
    const expectationDiscards = new Set(sameShanten.map((value) => value.discard.startsWith('0') ? value.discard : normalizeTile(value.discard)))
    for (const value of evaluations) {
      const choiceKey = value.discard.startsWith('0') ? value.discard : normalizeTile(value.discard)
      const counts = remainingCounts.get(choiceKey)
      if (!counts) continue
      const ukeire: UkeireResult = { shanten: value.shanten, tiles: value.ukeireTiles, count: value.ukeireCount, byTile: value.byTile }
      Object.assign(value, evaluateShapeQuality(counts, ukeire, options, visible, value.discard))
      if (expectationDiscards.has(choiceKey)) {
        value.nextUkeireExpectation = calculateExpectedNextUkeire(counts, options, visible, memo, [...ownDiscards, normalizeTile(value.discard)])
        value.speedDepth = speedDepthForShanten(value.shanten)
        value.speedScore = calculateProgressSpeed(
          counts,
          options,
          visible,
          [...ownDiscards, normalizeTile(value.discard)],
          value.speedDepth,
          progressMemo,
          value.discard,
        )
      }
    }
  }

  return evaluations.sort((a, b) =>
    a.shanten - b.shanten ||
    (b.speedScore ?? Number.NEGATIVE_INFINITY) - (a.speedScore ?? Number.NEGATIVE_INFINITY) ||
    effectiveGoodShapeCount(b.goodShapeCount, b.furiten) - effectiveGoodShapeCount(a.goodShapeCount, a.furiten) ||
    b.effectiveUkeireCount - a.effectiveUkeireCount ||
    (b.nextUkeireExpectation ?? Number.NEGATIVE_INFINITY) - (a.nextUkeireExpectation ?? Number.NEGATIVE_INFINITY) ||
    b.retainedDora - a.retainedDora ||
    a.standardShanten - b.standardShanten ||
    b.standardUkeireCount - a.standardUkeireCount ||
    b.retainedYakuPotential - a.retainedYakuPotential,
  )
}

export function efficiencyBest(evaluations: readonly DiscardEvaluation[]): DiscardEvaluation[] {
  const best = evaluations[0]
  return evaluations.filter((value) =>
    value.shanten === best.shanten &&
    value.speedScore === best.speedScore &&
    effectiveGoodShapeCount(value.goodShapeCount, value.furiten) === effectiveGoodShapeCount(best.goodShapeCount, best.furiten) &&
    value.effectiveUkeireCount === best.effectiveUkeireCount &&
    value.nextUkeireExpectation === best.nextUkeireExpectation &&
    value.retainedDora === best.retainedDora &&
    value.standardShanten === best.standardShanten &&
    value.standardUkeireCount === best.standardUkeireCount &&
    value.retainedYakuPotential === best.retainedYakuPotential,
  )
}
