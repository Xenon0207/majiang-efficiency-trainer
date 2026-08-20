import { indexToTile, type TileCode } from '../domain/tiles'

interface LocalStandardState {
  melds: number
  head: 0 | 1
  taatsu: number
}

const localStandardStateCache = new Map<string, LocalStandardState[]>()
const standardShantenCache = new Map<string, number>()

/**
 * 普通手向听拆成四门独立状态。摸切只改变一至两门，其余门直接命中这个缓存，
 * 避免次巡枚举时对几乎相同的整手牌重复递归。
 */
function localStandardStates(input: readonly number[], suited: boolean): LocalStandardState[] {
  const cacheKey = `${suited ? 'n' : 'z'}:${input.join('')}`
  const cached = localStandardStateCache.get(cacheKey)
  if (cached) return cached

  const counts = [...input]
  const results = new Map<string, LocalStandardState>()
  const visited = new Set<string>()

  function visit(melds: number, head: 0 | 1, taatsu: number) {
    const stateKey = `${counts.join('')}:${melds}:${head}:${taatsu}`
    if (visited.has(stateKey)) return
    visited.add(stateKey)
    const index = counts.findIndex((count) => count > 0)
    if (index < 0) {
      const value = { melds, head, taatsu }
      results.set(`${melds}/${head}/${taatsu}`, value)
      return
    }

    counts[index] -= 1
    visit(melds, head, taatsu)
    counts[index] += 1

    if (counts[index] >= 3) {
      counts[index] -= 3
      visit(melds + 1, head, taatsu)
      counts[index] += 3
    }

    if (suited && index <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      counts[index + 2] -= 1
      visit(melds + 1, head, taatsu)
      counts[index] += 1
      counts[index + 1] += 1
      counts[index + 2] += 1
    }

    if (counts[index] >= 2) {
      counts[index] -= 2
      if (head === 0) visit(melds, 1, taatsu)
      visit(melds, head, taatsu + 1)
      counts[index] += 2
    }

    if (suited && index <= 7 && counts[index + 1] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      visit(melds, head, taatsu + 1)
      counts[index] += 1
      counts[index + 1] += 1
    }

    if (suited && index <= 6 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 2] -= 1
      visit(melds, head, taatsu + 1)
      counts[index] += 1
      counts[index + 2] += 1
    }
  }

  visit(0, 0, 0)
  const states = [...results.values()]
  localStandardStateCache.set(cacheKey, states)
  return states
}

function standardShanten(input: readonly number[], fixedMelds = 0): number {
  const cacheKey = `${fixedMelds}:${input.join('')}`
  const cached = standardShantenCache.get(cacheKey)
  if (cached !== undefined) return cached
  const localStates = [
    localStandardStates(input.slice(0, 9), true),
    localStandardStates(input.slice(9, 18), true),
    localStandardStates(input.slice(18, 27), true),
    localStandardStates(input.slice(27, 34), false),
  ]
  let combined = new Map<string, LocalStandardState>([[`${fixedMelds}/0/0`, { melds: fixedMelds, head: 0, taatsu: 0 }]])

  for (const suitStates of localStates) {
    const next = new Map<string, LocalStandardState>()
    for (const total of combined.values()) {
      for (const local of suitStates) {
        const head = total.head + local.head
        if (head > 1) continue
        const value: LocalStandardState = { melds: total.melds + local.melds, head: head as 0 | 1, taatsu: total.taatsu + local.taatsu }
        next.set(`${value.melds}/${value.head}/${value.taatsu}`, value)
      }
    }
    combined = next
  }

  let best = 8 - fixedMelds * 2
  for (const value of combined.values()) {
    const cappedTaatsu = Math.min(value.taatsu, Math.max(0, 4 - value.melds))
    best = Math.min(best, 8 - value.melds * 2 - cappedTaatsu - value.head)
  }
  // 连续训练只会访问合法小状态；设置上限避免长时间会话无限增长。
  if (standardShantenCache.size >= 100_000) standardShantenCache.clear()
  standardShantenCache.set(cacheKey, best)
  return best
}

export interface StandardShapeAnalysis {
  shanten: number
  /** 所有最低向听普通手分割中，真正两面搭子的两侧进张。 */
  ryanmenWaits: TileCode[]
  /** 最低向听普通手分割中能够同时保留的最多两面搭子数。 */
  maxRyanmenTaatsu: number
  /** 最低向听普通手分割中能够同时完成的最多面子数（含固定面子）。 */
  maxMelds: number
}

/**
 * 只把 23～78 这种两张牌等左右两种牌的搭子视为好型。
 * 对子、嵌张、边张，以及仅仅拥有两种以上受入的形状都不会被计入。
 */
export function analyzeStandardShape(input: readonly number[], fixedMelds = 0): StandardShapeAnalysis {
  const counts = [...input]
  let best = 8 - fixedMelds * 2
  let bestRyanmenWaits = new Set<number>()
  let maxRyanmenTaatsu = 0
  let maxMelds = fixedMelds

  const evaluate = (melds: number, pairs: number, taatsu: number, ryanmenTaatsu: number, ryanmenWaits: ReadonlySet<number>) => {
    const cappedTaatsu = Math.min(taatsu, 4 - melds)
    const shanten = 8 - melds * 2 - cappedTaatsu - pairs
    if (shanten < best) {
      best = shanten
      bestRyanmenWaits = new Set<number>()
      maxRyanmenTaatsu = 0
      maxMelds = fixedMelds
    }
    if (shanten === best && cappedTaatsu > 0) {
      maxRyanmenTaatsu = Math.max(maxRyanmenTaatsu, Math.min(ryanmenTaatsu, cappedTaatsu))
      for (const wait of ryanmenWaits) bestRyanmenWaits.add(wait)
    }
    if (shanten === best) maxMelds = Math.max(maxMelds, melds)
  }

  const visit = (index: number, melds: number, pairs: number, taatsu: number, ryanmenTaatsu: number, ryanmenWaits: ReadonlySet<number>) => {
    while (index < 34 && counts[index] === 0) index += 1
    if (index >= 34) {
      evaluate(melds, pairs, taatsu, ryanmenTaatsu, ryanmenWaits)
      return
    }

    visit(index + 1, melds, pairs, taatsu, ryanmenTaatsu, ryanmenWaits)

    if (counts[index] >= 3) {
      counts[index] -= 3
      visit(index, melds + 1, pairs, taatsu, ryanmenTaatsu, ryanmenWaits)
      counts[index] += 3
    }

    const suited = index < 27
    const rank = index % 9
    if (suited && rank <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      counts[index + 2] -= 1
      visit(index, melds + 1, pairs, taatsu, ryanmenTaatsu, ryanmenWaits)
      counts[index] += 1
      counts[index + 1] += 1
      counts[index + 2] += 1
    }

    if (counts[index] >= 2) {
      counts[index] -= 2
      if (pairs === 0) visit(index, melds, 1, taatsu, ryanmenTaatsu, ryanmenWaits)
      visit(index, melds, pairs, taatsu + 1, ryanmenTaatsu, ryanmenWaits)
      counts[index] += 2
    }

    if (suited && rank <= 7 && counts[index + 1] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      if (rank >= 1 && rank <= 6) {
        const waits = new Set(ryanmenWaits)
        waits.add(index - 1)
        waits.add(index + 2)
        visit(index, melds, pairs, taatsu + 1, ryanmenTaatsu + 1, waits)
      } else {
        visit(index, melds, pairs, taatsu + 1, ryanmenTaatsu, ryanmenWaits)
      }
      counts[index] += 1
      counts[index + 1] += 1
    }

    if (suited && rank <= 6 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 2] -= 1
      visit(index, melds, pairs, taatsu + 1, ryanmenTaatsu, ryanmenWaits)
      counts[index] += 1
      counts[index + 2] += 1
    }
  }

  visit(0, fixedMelds, 0, 0, 0, new Set<number>())
  return { shanten: best, ryanmenWaits: [...bestRyanmenWaits].sort((a, b) => a - b).map(indexToTile), maxRyanmenTaatsu, maxMelds }
}

/** 两面只在普通手路线没有落后于七对子或国士时才参与好型评价。 */
export function analyzeBestRouteShape(counts: readonly number[], options: ShantenOptions = {}): StandardShapeAnalysis {
  const analysis = analyzeStandardShape(counts, options.fixedMelds ?? 0)
  return analysis.shanten === calculateShanten(counts, options)
    ? analysis
    : { shanten: calculateShanten(counts, options), ryanmenWaits: [], maxRyanmenTaatsu: 0, maxMelds: 0 }
}

export function ryanmenWaitsForBestRoute(counts: readonly number[], options: ShantenOptions = {}): TileCode[] {
  return analyzeBestRouteShape(counts, options).ryanmenWaits
}

function chiitoiShanten(counts: readonly number[]): number {
  const pairs = counts.filter((count) => count >= 2).length
  const unique = counts.filter((count) => count > 0).length
  return 6 - pairs + Math.max(0, 7 - unique)
}

function kokushiShanten(counts: readonly number[]): number {
  const terminals = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]
  const unique = terminals.filter((index) => counts[index] > 0).length
  const pair = terminals.some((index) => counts[index] >= 2)
  return 13 - unique - Number(pair)
}

export interface ShantenOptions {
  includeChiitoi?: boolean
  includeKokushi?: boolean
  /** 已经通过暗杠等方式固定在手牌外的面子数量。 */
  fixedMelds?: number
}

export interface RouteShanten {
  standard: number
  chiitoi: number
  kokushi: number
  minimum: number
}

export function calculateRouteShanten(counts: readonly number[], fixedMelds = 0): RouteShanten {
  const standard = standardShanten(counts, fixedMelds)
  const chiitoi = fixedMelds > 0 ? Number.POSITIVE_INFINITY : chiitoiShanten(counts)
  const kokushi = fixedMelds > 0 ? Number.POSITIVE_INFINITY : kokushiShanten(counts)
  return { standard, chiitoi, kokushi, minimum: Math.min(standard, chiitoi, kokushi) }
}

export function calculateShanten(counts: readonly number[], options: ShantenOptions = {}): number {
  if (counts.length !== 34) throw new Error('向听计算需要34种牌计数')
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total > 14) throw new Error('手牌不能超过14张')
  const fixedMelds = options.fixedMelds ?? 0
  const values = [standardShanten(counts, fixedMelds)]
  if (options.includeChiitoi && fixedMelds === 0) values.push(chiitoiShanten(counts))
  if (options.includeKokushi && fixedMelds === 0) values.push(kokushiShanten(counts))
  return Math.min(...values)
}

export interface UkeireResult {
  shanten: number
  tiles: TileCode[]
  count: number
  byTile: Record<string, number>
}

export function calculateUkeire(counts: readonly number[], options: ShantenOptions = {}, visible?: readonly number[]): UkeireResult {
  const shanten = calculateShanten(counts, options)
  const byTile: Record<string, number> = {}
  const tiles: TileCode[] = []
  let count = 0

  for (let index = 0; index < 34; index += 1) {
    const seen = visible?.[index] ?? counts[index]
    if (seen >= 4 || counts[index] >= 4) continue
    const next = [...counts]
    next[index] += 1
    if (calculateShanten(next, options) < shanten) {
      const remaining = 4 - seen
      const tile = indexToTile(index)
      tiles.push(tile)
      byTile[tile] = remaining
      count += remaining
    }
  }
  return { shanten, tiles, count, byTile }
}
