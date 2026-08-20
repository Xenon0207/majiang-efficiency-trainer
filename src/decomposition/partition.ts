import type { TileInstance } from '../domain/tiles'
import { groupTileIds, sortedVariants, type ResolvedShapeSegment } from './rules'

interface ScoredGroups {
  score: number
  groups: string[][]
}

const JAPANESE_HONORS = ['東', '南', '西', '北', '白', '發', '中'] as const

function removeIds(tiles: readonly TileInstance[], ids: readonly string[]): TileInstance[] {
  const removed = new Set(ids)
  return tiles.filter((tile) => !removed.has(tile.id))
}

function solveLooseGroups(tiles: readonly TileInstance[]): string[][] {
  function solve(remaining: readonly TileInstance[]): ScoredGroups {
    if (remaining.length === 0) return { score: 0, groups: [] }
    const ordered = [...remaining].sort((a, b) => a.rank - b.rank || Number(b.red) - Number(a.red))
    const first = ordered[0]
    const options: ScoredGroups[] = []

    function option(ids: string[], value: number) {
      const rest = solve(removeIds(ordered, ids))
      options.push({ score: value + rest.score, groups: [ids, ...rest.groups] })
    }

    option([first.id], 0)
    const same = ordered.filter((tile) => tile.normalized === first.normalized)
    if (same.length >= 2) option(same.slice(0, 2).map((tile) => tile.id), 35)
    if (same.length >= 3) option(same.slice(0, 3).map((tile) => tile.id), 100)

    if (first.suit !== 'z') {
      const byRank = (rank: number) => ordered.find((tile) => tile.rank === rank)
      const next = byRank(first.rank + 1)
      const nextTwo = byRank(first.rank + 2)
      if (next && nextTwo) option([first.id, next.id, nextTwo.id], 100)
      if (next) option([first.id, next.id], 22)
      if (nextTwo) option([first.id, nextTwo.id], 20)

      // 135、246、357……应作为一个连续嵌张复合搭子显示，不能拆成单张加嵌张。
      const spacedChain = [first]
      for (let rank = first.rank + 2; rank <= 9; rank += 2) {
        const tile = byRank(rank)
        if (!tile) break
        spacedChain.push(tile)
      }
      if (spacedChain.length >= 3) {
        option(spacedChain.map((tile) => tile.id), 26 + (spacedChain.length - 3) * 6)
      }
    }

    return options.sort((a, b) => b.score - a.score || a.groups.length - b.groups.length)[0]
  }

  return solve(tiles).groups
}

function formatGroup(group: readonly TileInstance[]): string {
  if (group[0].suit === 'z') return group.map((tile) => JAPANESE_HONORS[tile.rank - 1]).join('')
  return `${group.map((tile) => tile.code[0]).join('')}${group[0].suit}`
}

/** 以实际牌张和玩家当前排列生成答案分割；不依赖手写解释片段。 */
export function buildDisplayPartition(
  displayHand: readonly TileInstance[],
  discardId: string,
  segments: readonly ResolvedShapeSegment[],
): string[] {
  const tileById = new Map(displayHand.map((tile) => [tile.id, tile]))
  const remaining = new Set(displayHand.filter((tile) => tile.id !== discardId).map((tile) => tile.id))
  const groups: string[][] = []

  for (const segment of segments) {
    if (!segment.tileIds.every((id) => remaining.has(id))) continue
    const variant = sortedVariants(segment.rule)[0]
    for (const ids of groupTileIds(segment, variant.groups)) {
      groups.push(ids)
      ids.forEach((id) => remaining.delete(id))
    }
  }

  for (const suit of ['m', 'p', 's', 'z'] as const) {
    const loose = displayHand.filter((tile) => remaining.has(tile.id) && tile.suit === suit)
    for (const group of solveLooseGroups(loose)) {
      groups.push(group)
      group.forEach((id) => remaining.delete(id))
    }
  }

  const position = new Map(displayHand.map((tile, index) => [tile.id, index]))
  return groups
    .sort((a, b) => Math.min(...a.map((id) => position.get(id) ?? 999)) - Math.min(...b.map((id) => position.get(id) ?? 999)))
    .map((ids) => formatGroup(ids.map((id) => tileById.get(id)!).sort((a, b) => (position.get(a.id) ?? 999) - (position.get(b.id) ?? 999))))
}
