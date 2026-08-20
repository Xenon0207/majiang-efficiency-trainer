import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_SUIT_ORDERS, parseTiles, toCounts, type DragonOrder, type TileCode } from '../src/domain/tiles'
import { calculateRouteShanten } from '../src/solver/shanten'
import type { ContinuousSession, RouteFocus } from '../src/continuous/types'

const DRAGON_ORDERS: DragonOrder[] = [
  ['5z', '6z', '7z'],
  ['6z', '7z', '5z'],
  ['7z', '5z', '6z'],
]

function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function shuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values]
  const next = random(seed)
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(next() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function fullWall(): TileCode[] {
  const tiles: TileCode[] = []
  for (const suit of ['m', 'p', 's'] as const) {
    for (let rank = 1; rank <= 9; rank += 1) {
      const regularCopies = rank === 5 ? 3 : 4
      for (let copy = 0; copy < regularCopies; copy += 1) tiles.push(`${rank}${suit}` as TileCode)
      if (rank === 5) tiles.push(`0${suit}` as TileCode)
    }
  }
  for (let rank = 1; rank <= 7; rank += 1) {
    for (let copy = 0; copy < 4; copy += 1) tiles.push(`${rank}z` as TileCode)
  }
  return tiles
}

function removeTiles(wall: TileCode[], tiles: readonly TileCode[]) {
  for (const tile of tiles) {
    const index = wall.indexOf(tile)
    if (index < 0) throw new Error(`预设手牌超过牌山数量：${tile}`)
    wall.splice(index, 1)
  }
}

function contextFor(index: number, doraIndicator: TileCode) {
  return {
    roundWind: (index % 2 ? '2z' : '1z') as '1z' | '2z',
    seatWind: `${index % 4 + 1}z` as '1z' | '2z' | '3z' | '4z',
    doraIndicator,
  }
}

function buildSession(index: number, seed: number, routeFocus: RouteFocus, preset?: TileCode[], forcedFirstDraw?: TileCode): ContinuousSession {
  let deck = shuffle(fullWall(), seed)
  let initialTiles: TileCode[]
  let doraIndicator: TileCode

  if (preset) {
    deck = fullWall()
    removeTiles(deck, preset)
    if (forcedFirstDraw) removeTiles(deck, [forcedFirstDraw])
    deck = shuffle(deck, seed)
    doraIndicator = deck.shift()!
    initialTiles = [...preset]
    if (forcedFirstDraw) deck.unshift(forcedFirstDraw)
  } else {
    let attempt = 0
    do {
      deck = shuffle(fullWall(), seed + attempt * 7919)
      doraIndicator = deck.shift()!
      initialTiles = deck.splice(0, 13)
      attempt += 1
      const routes = calculateRouteShanten(toCounts(parseTiles(initialTiles.join(''))))
      if (routes.minimum >= 3 && routes.minimum <= 5) break
    } while (attempt < 200)
  }

  return {
    id: `continuous-${String(index + 1).padStart(2, '0')}`,
    title: `连续牌效 ${index + 1}`,
    routeFocus,
    initialTiles,
    wall: deck.slice(0, 70),
    suitOrder: ALL_SUIT_ORDERS[index % ALL_SUIT_ORDERS.length],
    dragonOrder: DRAGON_ORDERS[index % DRAGON_ORDERS.length],
    context: contextFor(index, doraIndicator!),
    generation: { seed, generatorVersion: 'continuous-static-2' },
  }
}

const presets: Array<{ focus: RouteFocus; tiles: TileCode[]; firstDraw?: TileCode }> = [
  { focus: 'chiitoi', tiles: ['1m', '1m', '2m', '2m', '3p', '3p', '4p', '4p', '5s', '5s', '6s', '1z', '2z'] },
  { focus: 'chiitoi', tiles: ['2m', '2m', '7m', '7m', '3p', '3p', '8s', '8s', '1p', '5p', '2s', '4z', '6z'] },
  { focus: 'kokushi', tiles: ['1m', '9m', '1p', '9p', '1s', '1z', '2z', '3z', '4z', '5z', '2s', '3s', '4p'] },
  { focus: 'kokushi', tiles: ['1m', '9m', '1p', '9s', '1z', '2z', '3z', '5z', '7z', '3m', '4m', '6p', '7s'] },
  { focus: 'mixed', tiles: ['2s', '2s', '2s', '1m', '2m', '3m', '9m', '4p', '5p', '6p', '7s', '8s', '1z'], firstDraw: '2s' },
]

const sessions: ContinuousSession[] = []
for (let index = 0; index < 11; index += 1) sessions.push(buildSession(index, 20260819 + index * 97, 'mixed'))
presets.forEach((preset, presetIndex) => sessions.push(buildSession(sessions.length, 20262000 + presetIndex * 131, preset.focus, preset.tiles, preset.firstDraw)))

writeFileSync(resolve('src/content/generated-continuous-sessions.json'), `${JSON.stringify(sessions, null, 2)}\n`)
console.log(`generated ${sessions.length} continuous sessions`)
