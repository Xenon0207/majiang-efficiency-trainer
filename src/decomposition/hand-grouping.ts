import type { Suit, TileInstance } from '../domain/tiles'

export type HandGroupKind = 'quad' | 'meld' | 'pair' | 'tatsu' | 'composite' | 'single'
export type HandGroupStatus = 'locked' | 'unlocked'

export interface RankGroup {
  kind: HandGroupKind
  ranks: number[]
}

export interface HandGroup extends RankGroup {
  id: string
  occurrenceKey: string
  tileIds: string[]
}

export interface SuitPartition {
  id: string
  groups: HandGroup[]
  effectiveRanks: number[]
  effectiveCount: number
  completeSets: number
  groupedTiles: number
  structuralScore: number
}

export interface SuitGrouping {
  suit: Suit
  tileIds: string[]
  variants: SuitPartition[]
  commonGroupKeys: Set<string>
}

export interface HandGroupingModel {
  suits: SuitGrouping[]
  tileSuit: Map<string, Suit>
}

export interface HandGroupingState {
  interacted: boolean
  cycleBySuit: Partial<Record<Suit, number>>
}

export interface HandGroupMark {
  groupId: string
  status: HandGroupStatus
}

const SUIT_ORDER: readonly Suit[] = ['m', 'p', 's', 'z']
const HONOR_NAMES = ['东', '南', '西', '北', '白', '发', '中'] as const
const SUIT_NAMES: Record<Suit, string> = { m: '万子', p: '饼子', s: '条子', z: '字牌' }

function group(kind: HandGroupKind, ...ranks: number[]): RankGroup {
  return { kind, ranks }
}

function firstRank(counts: readonly number[]): number {
  return counts.findIndex((count) => count > 0) + 1
}

function canTake(counts: readonly number[], ranks: readonly number[]): boolean {
  const needed = new Map<number, number>()
  for (const rank of ranks) needed.set(rank, (needed.get(rank) ?? 0) + 1)
  return [...needed].every(([rank, amount]) => (counts[rank - 1] ?? 0) >= amount)
}

function take(counts: readonly number[], ranks: readonly number[]): number[] {
  const next = [...counts]
  for (const rank of ranks) next[rank - 1] -= 1
  return next
}

function groupKey(value: RankGroup): string {
  return `${value.kind}:${value.ranks.join('')}`
}

function partitionKey(groups: readonly RankGroup[]): string {
  // 同一批组块即使递归时被取出的先后不同，也只是一种分割，不能占用多个循环位置。
  return groups.map(groupKey).sort().join('|')
}

function optionsAt(counts: readonly number[], suit: Suit): RankGroup[] {
  const rank = firstRank(counts)
  if (rank === 0) return []
  const options: RankGroup[] = []
  if (counts[rank - 1] >= 4) options.push(group('quad', rank, rank, rank, rank))
  if (counts[rank - 1] >= 3) options.push(group('meld', rank, rank, rank))
  if (suit !== 'z' && rank <= 7 && canTake(counts, [rank, rank + 1, rank + 2])) options.push(group('meld', rank, rank + 1, rank + 2))
  if (counts[rank - 1] >= 2) options.push(group('pair', rank, rank))

  if (suit !== 'z') {
    // 四连坎和两坎必须作为一个整体候选，不能被贪心拆成互不相干的坎张。
    if (rank <= 3 && canTake(counts, [rank, rank + 2, rank + 4, rank + 6])) {
      options.push(group('composite', rank, rank + 2, rank + 4, rank + 6))
    }
    if (rank <= 5 && canTake(counts, [rank, rank + 2, rank + 4])) {
      options.push(group('composite', rank, rank + 2, rank + 4))
    }
    if (rank <= 8 && canTake(counts, [rank, rank + 1])) options.push(group('tatsu', rank, rank + 1))
    if (rank <= 7 && canTake(counts, [rank, rank + 2])) options.push(group('tatsu', rank, rank + 2))
  }
  options.push(group('single', rank))
  return options
}

function enumerateRankPartitions(counts: readonly number[], suit: Suit): RankGroup[][] {
  const memo = new Map<string, RankGroup[][]>()
  function visit(remaining: readonly number[]): RankGroup[][] {
    const key = remaining.join('')
    const cached = memo.get(key)
    if (cached) return cached
    if (firstRank(remaining) === 0) return [[]]

    const deduped = new Map<string, RankGroup[]>()
    for (const candidate of optionsAt(remaining, suit)) {
      for (const tail of visit(take(remaining, candidate.ranks))) {
        const value = [candidate, ...tail]
        const partition = partitionKey(value)
        if (!deduped.has(partition)) deduped.set(partition, value)
      }
    }
    const result = [...deduped.values()]
    memo.set(key, result)
    return result
  }
  return visit(counts)
}

function effectiveRanksForGroup(value: RankGroup): number[] {
  if (value.kind === 'pair') return [value.ranks[0]]
  if (value.kind === 'tatsu') {
    const [left, right] = value.ranks
    if (right - left === 2) return [left + 1]
    if (left === 1) return [3]
    if (right === 9) return [7]
    return [left - 1, right + 1]
  }
  if (value.kind === 'composite') {
    const ranks: number[] = []
    for (let index = 0; index < value.ranks.length - 1; index += 1) ranks.push(value.ranks[index] + 1)
    return ranks
  }
  return []
}

function structuralValue(value: RankGroup): number {
  switch (value.kind) {
    case 'quad': return 13
    case 'meld': return 12
    case 'composite': return value.ranks.length === 4 ? 9 : 7
    case 'pair': return 5
    case 'tatsu': return 4
    case 'single': return 0
  }
}

function scorePartition(groups: readonly RankGroup[], originalCounts: readonly number[]) {
  const effectiveRanks = [...new Set(groups.flatMap(effectiveRanksForGroup))].sort((a, b) => a - b)
  return {
    effectiveRanks,
    effectiveCount: effectiveRanks.reduce((sum, rank) => sum + Math.max(0, 4 - originalCounts[rank - 1]), 0),
    completeSets: groups.filter((value) => value.kind === 'meld' || value.kind === 'quad').length,
    groupedTiles: groups.filter((value) => value.kind !== 'single').reduce((sum, value) => sum + value.ranks.length, 0),
    structuralScore: groups.reduce((sum, value) => sum + structuralValue(value), 0),
  }
}

function hasTwoRyanmen(groups: readonly RankGroup[]): boolean {
  return groups.filter((value) =>
    value.kind === 'tatsu' &&
    value.ranks[1] - value.ranks[0] === 1 &&
    value.ranks[0] >= 2 &&
    value.ranks[1] <= 8,
  ).length >= 2
}

function comparePartitions(a: Omit<SuitPartition, 'groups'>, b: Omit<SuitPartition, 'groups'>): number {
  return b.effectiveCount - a.effectiveCount ||
    b.completeSets - a.completeSets ||
    b.groupedTiles - a.groupedTiles ||
    b.structuralScore - a.structuralScore ||
    a.id.localeCompare(b.id)
}

function assignTiles(groups: readonly RankGroup[], tiles: readonly TileInstance[], partitionId: string): HandGroup[] {
  const available = [...tiles].sort((a, b) => a.rank - b.rank || Number(b.red) - Number(a.red) || a.id.localeCompare(b.id))
  const occurrence = new Map<string, number>()
  return groups.map((value, groupIndex) => {
    const baseKey = groupKey(value)
    const copy = occurrence.get(baseKey) ?? 0
    occurrence.set(baseKey, copy + 1)
    const tileIds = value.ranks.map((rank) => {
      const index = available.findIndex((tile) => tile.rank === rank)
      if (index < 0) throw new Error(`分组 ${partitionId} 无法映射牌 ${rank}`)
      return available.splice(index, 1)[0].id
    })
    return {
      ...value,
      id: `${partitionId}-g${groupIndex}`,
      occurrenceKey: `${baseKey}#${copy}`,
      tileIds,
    }
  })
}

function buildSuitGrouping(tiles: readonly TileInstance[], suit: Suit): SuitGrouping {
  const size = suit === 'z' ? 7 : 9
  const counts = Array<number>(size).fill(0)
  for (const tile of tiles) counts[tile.rank - 1] += 1
  const raw = enumerateRankPartitions(counts, suit)
  const scored = raw.map((groups) => {
    const metrics = scorePartition(groups, counts)
    const id = partitionKey(groups)
    return { id, groups, ...metrics }
  })
  const bestStructural = Math.max(...scored.map((value) => value.structuralScore))
  const bestGrouped = Math.max(...scored.map((value) => value.groupedTiles))
  const bestEffective = Math.max(...scored.map((value) => value.effectiveCount))
  const reasonable = scored
    .filter((value) =>
      (value.structuralScore >= bestStructural - 4 && value.groupedTiles >= bestGrouped - 1) ||
      // 245568 -> 2 / 45 / 56 / 8：两张 5 分属两个可同时成立的两面。
      // 即使浮牌令“已成组张数”较低，只要它达到本门最高理论受入，就必须保留为可切换方案。
      (value.effectiveCount === bestEffective && hasTwoRyanmen(value.groups)),
    )
    .sort(comparePartitions)
    .slice(0, 12)

  const variants = reasonable.map((value, index) => ({
    ...value,
    id: `${suit}-v${index}-${value.id}`,
    groups: assignTiles(value.groups, tiles, `${suit}-v${index}`),
  }))
  const commonGroupKeys = new Set(variants[0]?.groups.filter((value) => value.kind !== 'single').map((value) => value.occurrenceKey) ?? [])
  for (const variant of variants.slice(1)) {
    const keys = new Set(variant.groups.filter((value) => value.kind !== 'single').map((value) => value.occurrenceKey))
    for (const key of commonGroupKeys) if (!keys.has(key)) commonGroupKeys.delete(key)
  }
  return { suit, tileIds: tiles.map((tile) => tile.id), variants, commonGroupKeys }
}

export function buildHandGroupingModel(hand: readonly TileInstance[]): HandGroupingModel {
  const firstSuitPosition = new Map<Suit, number>()
  hand.forEach((tile, index) => { if (!firstSuitPosition.has(tile.suit)) firstSuitPosition.set(tile.suit, index) })
  const presentSuits = SUIT_ORDER.filter((suit) => hand.some((tile) => tile.suit === suit))
    .sort((a, b) => (firstSuitPosition.get(a) ?? 99) - (firstSuitPosition.get(b) ?? 99))
  return {
    suits: presentSuits.map((suit) => buildSuitGrouping(hand.filter((tile) => tile.suit === suit), suit)),
    tileSuit: new Map(hand.map((tile) => [tile.id, tile.suit])),
  }
}

export function createHandGroupingState(): HandGroupingState {
  return { interacted: false, cycleBySuit: {} }
}

export function selectedSuitPartition(grouping: SuitGrouping, state: HandGroupingState): SuitPartition {
  const index = state.cycleBySuit[grouping.suit] ?? 0
  return grouping.variants[index % Math.max(1, grouping.variants.length)]
}

export function clickHandGrouping(state: HandGroupingState, model: HandGroupingModel, tileId: string): HandGroupingState {
  const suit = model.tileSuit.get(tileId)
  if (!suit) return state
  const grouping = model.suits.find((value) => value.suit === suit)
  if (!grouping) return state
  const current = state.cycleBySuit[suit] ?? 0
  return {
    interacted: true,
    cycleBySuit: {
      ...state.cycleBySuit,
      [suit]: state.interacted && grouping.variants.length > 1 ? (current + 1) % grouping.variants.length : current,
    },
  }
}

export function handGroupMarks(model: HandGroupingModel, state: HandGroupingState): Map<string, HandGroupMark> {
  const result = new Map<string, HandGroupMark>()
  if (!state.interacted) return result
  for (const suit of model.suits) {
    const partition = selectedSuitPartition(suit, state)
    for (const value of partition.groups) {
      if (value.kind === 'single') continue
      const status: HandGroupStatus = suit.commonGroupKeys.has(value.occurrenceKey) ? 'locked' : 'unlocked'
      for (const tileId of value.tileIds) result.set(tileId, { groupId: value.id, status })
    }
  }
  return result
}

export function arrangeHandForGrouping(hand: readonly TileInstance[], model: HandGroupingModel, state: HandGroupingState): TileInstance[] {
  if (!state.interacted) return [...hand]
  const result = [...hand]
  const tileById = new Map(hand.map((tile) => [tile.id, tile]))
  for (const suit of model.suits) {
    const positions = result.map((tile, index) => tile.suit === suit.suit ? index : -1).filter((index) => index >= 0)
    const orderedIds = selectedSuitPartition(suit, state).groups.flatMap((value) => value.tileIds)
    positions.forEach((position, index) => { result[position] = tileById.get(orderedIds[index])! })
  }
  return result
}

export function suitName(suit: Suit): string {
  return SUIT_NAMES[suit]
}

export function formatGroup(value: RankGroup, suit: Suit): string {
  if (suit === 'z') return value.ranks.map((rank) => HONOR_NAMES[rank - 1]).join('')
  return `${value.ranks.join('')}${suit}`
}
