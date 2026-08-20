import { ALL_SUIT_ORDERS, type DragonOrder, type TileCode } from '../domain/tiles'
import type { ContinuousSession } from './types'

const DRAGON_ORDERS: readonly DragonOrder[] = [
  ['5z', '6z', '7z'],
  ['6z', '7z', '5z'],
  ['7z', '5z', '6z'],
]

function randomSeed(): number {
  const values = new Uint32Array(1)
  globalThis.crypto.getRandomValues(values)
  return values[0]
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function fullWall(): TileCode[] {
  const tiles: TileCode[] = []
  for (const suit of ['m', 'p', 's'] as const) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < (rank === 5 ? 3 : 4); copy += 1) tiles.push(`${rank}${suit}` as TileCode)
      if (rank === 5) tiles.push(`0${suit}` as TileCode)
    }
  }
  for (let rank = 1; rank <= 7; rank += 1) {
    for (let copy = 0; copy < 4; copy += 1) tiles.push(`${rank}z` as TileCode)
  }
  return tiles
}

function shuffle<T>(values: readonly T[], next: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(next() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

/**
 * 浏览器端即时洗出完整合法牌山。seed 仅用于复现测试与问题牌局；正常开始训练时自动随机。
 * 不按向听或路线筛选起手，确保起手、宝牌与后续进张都来自同一次均匀洗牌。
 */
export function createRandomContinuousSession(seed = randomSeed()): ContinuousSession {
  const next = seededRandom(seed)
  const deck = shuffle(fullWall(), next)
  const doraIndicator = deck.shift()!
  const initialTiles = deck.splice(0, 13)
  const suffix = seed.toString(36).padStart(7, '0').slice(-5).toUpperCase()

  return {
    id: `continuous-random-${seed}`,
    title: `随机连续牌效 · ${suffix}`,
    routeFocus: 'mixed',
    initialTiles,
    wall: deck,
    suitOrder: ALL_SUIT_ORDERS[Math.floor(next() * ALL_SUIT_ORDERS.length)],
    dragonOrder: DRAGON_ORDERS[Math.floor(next() * DRAGON_ORDERS.length)],
    context: {
      roundWind: next() < 0.5 ? '1z' : '2z',
      seatWind: `${Math.floor(next() * 4) + 1}z` as '1z' | '2z' | '3z' | '4z',
      doraIndicator,
    },
    generation: { seed, generatorVersion: 'continuous-runtime-1' },
  }
}
