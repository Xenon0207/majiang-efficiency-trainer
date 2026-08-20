import type { Suit, TileInstance } from '../domain/tiles'

export interface GroupVariant {
  id: string
  groups: string[]
  theoreticalUkeire: number
  quality: number
  improvement: number
  valuePotential: number
}

export interface ShapeRule {
  pattern: string
  label: string
  forced: boolean
  variants: GroupVariant[]
}

function variant(id: string, groups: string[], theoreticalUkeire: number, quality: number, improvement = 0, valuePotential = 0): GroupVariant {
  return { id, groups, theoreticalUkeire, quality, improvement, valuePotential }
}

export const SHAPE_RULES: Record<string, ShapeRule> = {
  '123': { pattern: '123', label: '完成顺子', forced: true, variants: [variant('123-meld', ['123'], 0, 4)] },
  '234': { pattern: '234', label: '完成顺子', forced: true, variants: [variant('234-meld', ['234'], 0, 4)] },
  '345': { pattern: '345', label: '完成顺子', forced: true, variants: [variant('345-meld', ['345'], 0, 4)] },
  '456': { pattern: '456', label: '完成顺子', forced: true, variants: [variant('456-meld', ['456'], 0, 4)] },
  '567': { pattern: '567', label: '完成顺子', forced: true, variants: [variant('567-meld', ['567'], 0, 4)] },
  '678': { pattern: '678', label: '完成顺子', forced: true, variants: [variant('678-meld', ['678'], 0, 4)] },
  '789': { pattern: '789', label: '完成顺子', forced: true, variants: [variant('789-meld', ['789'], 0, 4)] },
  '111': { pattern: '111', label: '完成刻子', forced: true, variants: [variant('111-triplet', ['111'], 0, 4)] },
  '222': { pattern: '222', label: '完成刻子', forced: true, variants: [variant('222-triplet', ['222'], 0, 4)] },
  '333': { pattern: '333', label: '完成刻子', forced: true, variants: [variant('333-triplet', ['333'], 0, 4)] },
  '444': { pattern: '444', label: '完成刻子', forced: true, variants: [variant('444-triplet', ['444'], 0, 4)] },
  '555': { pattern: '555', label: '完成刻子', forced: true, variants: [variant('555-triplet', ['555'], 0, 4)] },
  '666': { pattern: '666', label: '完成刻子', forced: true, variants: [variant('666-triplet', ['666'], 0, 4)] },
  '777': { pattern: '777', label: '完成刻子', forced: true, variants: [variant('777-triplet', ['777'], 0, 4)] },
  '888': { pattern: '888', label: '完成刻子', forced: true, variants: [variant('888-triplet', ['888'], 0, 4)] },
  '999': { pattern: '999', label: '完成刻子', forced: true, variants: [variant('999-triplet', ['999'], 0, 4)] },
  '2334': {
    pattern: '2334', label: '两面复合形', forced: false,
    variants: [variant('2334-double', ['23', '34'], 14, 5, 4), variant('2334-meld', ['234', '3'], 8, 3, 2)],
  },
  '4556': {
    pattern: '4556', label: '中膨形', forced: false,
    variants: [variant('4556-double', ['45', '56'], 14, 5, 4, 1), variant('4556-meld', ['456', '5'], 8, 3, 2, 1)],
  },
  '4567': {
    pattern: '4567', label: '四连形', forced: false,
    variants: [variant('4567-double', ['45', '67'], 16, 5, 6), variant('4567-left', ['456', '7'], 8, 3, 3), variant('4567-right', ['4', '567'], 8, 3, 3)],
  },
  '4456': {
    pattern: '4456', label: '亚两面形', forced: false,
    variants: [variant('4456-pair', ['44', '56'], 10, 4, 3, 1), variant('4456-meld', ['4', '456'], 8, 3, 2, 1)],
  },
  '3567': {
    pattern: '3567', label: '跳一复合形', forced: false,
    variants: [variant('3567-double', ['35', '67'], 12, 4, 4), variant('3567-meld', ['3', '567'], 8, 3, 2)],
  },
  '4445': {
    pattern: '4445', label: '刻子复合形', forced: false,
    variants: [variant('4445-triplet', ['444', '5'], 7, 3, 2), variant('4445-pair', ['44', '45'], 6, 4, 2, 1)],
  },
  '246': {
    pattern: '246', label: '两坎复合搭子', forced: true,
    variants: [variant('246-combined', ['246'], 8, 3, 3)],
  },
  '2468': {
    pattern: '2468', label: '连续嵌张复合搭子', forced: true,
    variants: [variant('2468-combined', ['2468'], 8, 3, 4)],
  },
  '3556': {
    pattern: '3556', label: '有效牌重复形', forced: false,
    variants: [variant('3556-overlap', ['35', '56'], 10, 3, 2), variant('3556-pair', ['3', '55', '6'], 7, 2, 2)],
  },
  '5566': {
    pattern: '5566', label: '严重有效牌重复', forced: false,
    variants: [variant('5566-double', ['56', '56'], 8, 3, 1, 1), variant('5566-pairs', ['55', '66'], 4, 2, 1, 1)],
  },
}

for (let rank = 1; rank <= 9; rank += 1) {
  const digit = String(rank)
  const pair = digit.repeat(2)
  const single = digit
  if (!SHAPE_RULES[pair]) SHAPE_RULES[pair] = { pattern: pair, label: '对子', forced: true, variants: [variant(`${pair}-pair`, [pair], 2, 3)] }
  if (!SHAPE_RULES[single]) SHAPE_RULES[single] = { pattern: single, label: '浮牌', forced: true, variants: [variant(`${single}-single`, [single], 0, 0)] }
}

for (let rank = 1; rank <= 8; rank += 1) {
  const pattern = `${rank}${rank + 1}`
  SHAPE_RULES[pattern] = {
    pattern,
    label: rank === 1 || rank === 8 ? '边张搭子' : '相邻搭子',
    forced: true,
    variants: [variant(`${pattern}-adjacent`, [pattern], rank === 1 || rank === 8 ? 4 : 8, rank === 1 || rank === 8 ? 1 : 4)],
  }
}

for (let rank = 1; rank <= 7; rank += 1) {
  const pattern = `${rank}${rank + 2}`
  SHAPE_RULES[pattern] = { pattern, label: '嵌张搭子', forced: true, variants: [variant(`${pattern}-gap`, [pattern], 4, 2)] }
}

for (let rank = 1; rank <= 5; rank += 1) {
  const chain = `${rank}${rank + 2}${rank + 4}`
  if (!SHAPE_RULES[chain]) {
    SHAPE_RULES[chain] = { pattern: chain, label: '两坎复合搭子', forced: true, variants: [variant(`${chain}-combined`, [chain], 8, 3, 3)] }
  }
  const doubled = [...chain].map((digit) => digit.repeat(2)).join('')
  SHAPE_RULES[doubled] = {
    pattern: doubled,
    label: '双两坎・七对复合形',
    forced: false,
    variants: [
      variant(`${doubled}-double-kanchan`, [chain, chain], 16, 4, 5),
      variant(`${doubled}-three-pairs`, [...chain].map((digit) => digit.repeat(2)), 6, 2, 2),
    ],
  }
}

for (let rank = 1; rank <= 3; rank += 1) {
  const chain = `${rank}${rank + 2}${rank + 4}${rank + 6}`
  if (!SHAPE_RULES[chain]) {
    SHAPE_RULES[chain] = { pattern: chain, label: '连续嵌张复合搭子', forced: true, variants: [variant(`${chain}-combined`, [chain], 12, 3, 5)] }
  }
}

function mirrorDigits(value: string): string {
  return [...value].map((digit) => String(10 - Number(digit))).sort().join('')
}

// 数牌镜像是离线生成器的等价变换。这里预编译镜像规则，点击时仍然只查表。
for (const rule of Object.values({ ...SHAPE_RULES })) {
  const mirroredPattern = mirrorDigits(rule.pattern)
  if (SHAPE_RULES[mirroredPattern]) continue
  SHAPE_RULES[mirroredPattern] = {
    ...rule,
    pattern: mirroredPattern,
    variants: rule.variants.map((source) => ({
      ...source,
      id: `${source.id}-mirror`,
      groups: source.groups.map(mirrorDigits).sort((a, b) => Number(a) - Number(b)),
    })),
  }
}

export interface ShapeSegmentSpec {
  id: string
  suit: Suit
  pattern: string
}

export interface ResolvedShapeSegment extends ShapeSegmentSpec {
  tileIds: string[]
  rule: ShapeRule
}

/** 按分组中的数字取实际牌 ID，支持 [357][357] 这类在自动排序中彼此交错的分组。 */
export function groupTileIds(segment: ResolvedShapeSegment, groups: readonly string[]): string[][] {
  const available = [...segment.tileIds]
  return groups.map((group) => [...group].map((digit) => {
    const index = available.findIndex((id) => Number(id[0]) === Number(digit))
    if (index < 0) throw new Error(`分组 ${groups.join('/')} 无法映射到 ${segment.pattern}${segment.suit}`)
    return available.splice(index, 1)[0]
  }))
}

export function resolveShapeSegments(hand: readonly TileInstance[], specs: readonly ShapeSegmentSpec[]): ResolvedShapeSegment[] {
  return specs.map((spec) => {
    const rule = SHAPE_RULES[spec.pattern]
    if (!rule) throw new Error(`缺少分割规则：${spec.pattern}`)
    const suited = hand.filter((tile) => tile.suit === spec.suit).sort((a, b) => a.rank - b.rank)
    const available = [...suited]
    const matched: TileInstance[] = []
    for (const digit of spec.pattern) {
      const index = available.findIndex((tile) => tile.rank === Number(digit))
      if (index < 0) throw new Error(`手牌中找不到 ${spec.pattern}${spec.suit}`)
      matched.push(available[index])
      available.splice(index, 1)
    }
    return { ...spec, rule, tileIds: matched.map((tile) => tile.id) }
  })
}

export function sortedVariants(rule: ShapeRule): GroupVariant[] {
  return [...rule.variants].sort((a, b) =>
    b.theoreticalUkeire - a.theoreticalUkeire ||
    b.quality - a.quality ||
    b.improvement - a.improvement ||
    b.valuePotential - a.valuePotential ||
    a.groups.length - b.groups.length ||
    a.id.localeCompare(b.id),
  )
}

/** 为连续训练从当前手牌中查找互不重叠的已知局部形状；运行时只匹配规则表，不计算受入。 */
export function inferShapeSegments(hand: readonly TileInstance[]): ResolvedShapeSegment[] {
  const candidates = Object.values(SHAPE_RULES)
    .filter((rule, index, rules) => rules.findIndex((item) => item.pattern === rule.pattern) === index)
    .sort((a, b) =>
      b.pattern.length - a.pattern.length ||
      Number(a.forced) - Number(b.forced) ||
      sortedVariants(b)[0].theoreticalUkeire - sortedVariants(a)[0].theoreticalUkeire ||
      a.pattern.localeCompare(b.pattern),
    )
  const result: ResolvedShapeSegment[] = []

  for (const suit of ['m', 'p', 's', 'z'] as const) {
    const available = hand.filter((tile) => tile.suit === suit).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
    let sequence = 0
    for (const rule of candidates) {
      if (suit === 'z' && rule.pattern.length > 1 && new Set(rule.pattern).size > 1) continue
      while (available.length > 0) {
        const pool = [...available]
        const matched: TileInstance[] = []
        for (const digit of rule.pattern) {
          const index = pool.findIndex((tile) => tile.rank === Number(digit))
          if (index < 0) {
            matched.length = 0
            break
          }
          matched.push(pool[index])
          pool.splice(index, 1)
        }
        if (!matched.length) break
        matched.forEach((tile) => available.splice(available.findIndex((item) => item.id === tile.id), 1))
        result.push({
          id: `auto-${suit}-${rule.pattern}-${sequence++}`,
          suit,
          pattern: rule.pattern,
          tileIds: matched.map((tile) => tile.id),
          rule,
        })
      }
    }
  }
  return result
}
