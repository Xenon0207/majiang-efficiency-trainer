export type NumberSuit = 'm' | 'p' | 's'
export type Suit = NumberSuit | 'z'
export type TileCode = `${number}${Suit}`
export type SuitOrder = readonly [NumberSuit, NumberSuit, NumberSuit]
export type DragonOrder = readonly [TileCode, TileCode, TileCode]

export interface TileInstance {
  id: string
  code: TileCode
  normalized: TileCode
  suit: Suit
  rank: number
  red: boolean
}

export const DEFAULT_SUIT_ORDER: SuitOrder = ['m', 'p', 's']
export const DEFAULT_DRAGON_ORDER: DragonOrder = ['5z', '6z', '7z']
export const ALL_SUIT_ORDERS: readonly SuitOrder[] = [
  ['m', 'p', 's'],
  ['m', 's', 'p'],
  ['p', 'm', 's'],
  ['p', 's', 'm'],
  ['s', 'm', 'p'],
  ['s', 'p', 'm'],
]

const HONOR_LABELS = ['东', '南', '西', '北', '白', '发', '中'] as const
const SUIT_LABELS: Record<NumberSuit, string> = { m: '万', p: '饼', s: '条' }

export function normalizeTile(code: TileCode): TileCode {
  return code[0] === '0' ? (`5${code[1]}` as TileCode) : code
}

export function parseTiles(notation: string): TileInstance[] {
  const compact = notation.replace(/\s+/g, '')
  const tiles: TileInstance[] = []
  let digits = ''
  const copies = new Map<string, number>()

  for (const char of compact) {
    if (/\d/.test(char)) {
      digits += char
      continue
    }
    if (!/[mpsz]/.test(char) || digits.length === 0) {
      throw new Error(`无法解析手牌：${notation}`)
    }
    for (const digit of digits) {
      const code = `${digit}${char}` as TileCode
      const normalized = normalizeTile(code)
      const suit = char as Suit
      const rank = Number(normalized[0])
      if (suit === 'z' && (digit === '0' || rank < 1 || rank > 7)) {
        throw new Error(`非法字牌：${code}`)
      }
      if (suit !== 'z' && rank > 9) throw new Error(`非法数牌：${code}`)
      const copy = copies.get(normalized) ?? 0
      copies.set(normalized, copy + 1)
      tiles.push({
        id: `${normalized}-${copy}-${code[0] === '0' ? 'r' : 'n'}`,
        code,
        normalized,
        suit,
        rank,
        red: code[0] === '0',
      })
    }
    digits = ''
  }
  if (digits.length > 0) throw new Error(`手牌缺少花色：${notation}`)
  validateTileMultiplicity(tiles)
  return tiles
}

export function validateTileMultiplicity(tiles: readonly TileInstance[]): void {
  const counts = new Map<TileCode, number>()
  for (const tile of tiles) {
    const next = (counts.get(tile.normalized) ?? 0) + 1
    if (next > 4) throw new Error(`${tile.normalized} 超过四张`)
    counts.set(tile.normalized, next)
  }
}

export function tileToIndex(code: TileCode): number {
  const normalized = normalizeTile(code)
  const rank = Number(normalized[0])
  switch (normalized[1]) {
    case 'm': return rank - 1
    case 'p': return 9 + rank - 1
    case 's': return 18 + rank - 1
    case 'z': return 27 + rank - 1
    default: throw new Error(`未知牌：${code}`)
  }
}

export function indexToTile(index: number): TileCode {
  if (index < 0 || index >= 34) throw new Error(`非法牌索引：${index}`)
  if (index < 9) return `${index + 1}m` as TileCode
  if (index < 18) return `${index - 8}p` as TileCode
  if (index < 27) return `${index - 17}s` as TileCode
  return `${index - 26}z` as TileCode
}

export function toCounts(tiles: readonly TileInstance[]): number[] {
  const counts = Array<number>(34).fill(0)
  for (const tile of tiles) counts[tileToIndex(tile.normalized)] += 1
  return counts
}

export function sortTiles(
  tiles: readonly TileInstance[],
  suitOrder: SuitOrder,
  dragonOrder: DragonOrder = DEFAULT_DRAGON_ORDER,
): TileInstance[] {
  const suitRank = new Map<Suit, number>([
    [suitOrder[0], 0], [suitOrder[1], 1], [suitOrder[2], 2], ['z', 3],
  ])
  return [...tiles].sort((a, b) => {
    const suitDelta = (suitRank.get(a.suit) ?? 9) - (suitRank.get(b.suit) ?? 9)
    if (suitDelta !== 0) return suitDelta
    if (a.suit === 'z' && b.suit === 'z' && a.rank >= 5 && b.rank >= 5) {
      const dragonRank = new Map(dragonOrder.map((tile, index) => [Number(tile[0]), index]))
      return (dragonRank.get(a.rank) ?? 9) - (dragonRank.get(b.rank) ?? 9)
    }
    if (a.rank !== b.rank) return a.rank - b.rank
    return Number(b.red) - Number(a.red)
  })
}

export function tileLabel(code: TileCode): string {
  const normalized = normalizeTile(code)
  const rank = Number(normalized[0])
  if (normalized[1] === 'z') return HONOR_LABELS[rank - 1]
  return `${code[0] === '0' ? '赤5' : rank}${SUIT_LABELS[normalized[1] as NumberSuit]}`
}

export function tileImage(code: TileCode): string {
  const suit = code[1] as Suit
  const red = code[0] === '0'
  const rank = Number(red ? 5 : code[0])
  if (suit === 'm') return `./tiles/Man${rank}${red ? '-Dora' : ''}.png`
  if (suit === 'p') return `./tiles/Pin${rank}${red ? '-Dora' : ''}.png`
  if (suit === 's') return `./tiles/Sou${rank}${red ? '-Dora' : ''}.png`
  return `./tiles/${['Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'][rank - 1]}.png`
}

export function doraFromIndicator(indicator: TileCode): TileCode {
  const normalized = normalizeTile(indicator)
  const rank = Number(normalized[0])
  const suit = normalized[1] as Suit
  if (suit !== 'z') return `${rank === 9 ? 1 : rank + 1}${suit}` as TileCode
  if (rank <= 4) return `${rank === 4 ? 1 : rank + 1}z` as TileCode
  return `${rank === 7 ? 5 : rank + 1}z` as TileCode
}

export function countDora(tiles: readonly TileInstance[], indicator: TileCode): number {
  const dora = doraFromIndicator(indicator)
  return tiles.reduce((sum, tile) => sum + Number(tile.normalized === dora) + Number(tile.red), 0)
}
