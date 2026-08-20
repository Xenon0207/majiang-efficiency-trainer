import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { questions as seeds } from '../src/content/questions'
import type { NumberSuit, TileCode } from '../src/domain/tiles'
import type { Question } from '../src/content/types'

const VERSION = 'structured-variation-2'
type HonorRank = '1' | '2' | '3' | '4' | '5' | '6' | '7'
type Transform = {
  id: string
  map: Record<NumberSuit, NumberSuit>
  rank: 'identity' | 'mirror'
  honors: Record<HonorRank, HonorRank>
}

const transforms: Transform[] = [
  { id: 'mps-a', map: { m: 'm', p: 'p', s: 's' }, rank: 'identity', honors: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7' } },
  { id: 'msp-b', map: { m: 'm', p: 's', s: 'p' }, rank: 'mirror', honors: { '1': '1', '2': '2', '3': '4', '4': '3', '5': '6', '6': '7', '7': '5' } },
  { id: 'pms-c', map: { m: 'p', p: 'm', s: 's' }, rank: 'identity', honors: { '1': '2', '2': '1', '3': '4', '4': '3', '5': '7', '6': '5', '7': '6' } },
  { id: 'psm-d', map: { m: 'p', p: 's', s: 'm' }, rank: 'mirror', honors: { '1': '2', '2': '1', '3': '3', '4': '4', '5': '5', '6': '7', '7': '6' } },
  { id: 'smp-e', map: { m: 's', p: 'm', s: 'p' }, rank: 'identity', honors: { '1': '1', '2': '2', '3': '4', '4': '3', '5': '7', '6': '6', '7': '5' } },
  { id: 'spm-f', map: { m: 's', p: 'p', s: 'm' }, rank: 'mirror', honors: { '1': '2', '2': '1', '3': '3', '4': '4', '5': '6', '6': '5', '7': '7' } },
]

const isolationScenarios: Array<Partial<Question> & { scenario: string }> = [
  {
    scenario: 'guest-wind-and-dragon',
    hand: '123p456s24m05p3z6z8m9s', answerTiles: ['3z'],
    title: '客风与役牌', prompt: '客风和役牌同时孤立时，哪张更应该先离开？',
    explanation: { summary: '西是客风，只能靠摸成对子；发可以成为役牌，因此先切西。', bestPartition: ['123', '456', '24', '55', '8', '9', '发'], contrast: '两者当前受入相同，但役牌保留了直接的一番来源。' },
  },
  {
    scenario: 'winds-only',
    hand: '123p456s24m05p1z4z8m9s', answerTiles: ['4z'],
    title: '只有风牌时', prompt: '这里只有两张风牌；结合场风和自风判断先切哪张。',
    context: { roundWind: '1z', seatWind: '2z', doraIndicator: '7p' },
    explanation: { summary: '东是场风，北是客风；两者牌效相同，但东有役牌价值，所以先切北。', bestPartition: ['123', '456', '24', '55', '8', '9', '东'], contrast: '不能把所有风牌一概当作无价值字牌，先确认场风和自风。' },
  },
  {
    scenario: 'dragons-only',
    hand: '123p456s24m05p5z7z8m9s', answerTiles: ['5z', '7z'],
    title: '只有箭牌时', prompt: '白和中都没有成对；只看牌效时应该如何处理？',
    explanation: { summary: '白和中都是孤立箭牌，成刻后都有一番，当前牌效与价值完全相同，切任意一张都可以。', bestPartition: ['123', '456', '24', '55', '8', '9', '白或中'], contrast: '箭牌名称不同不会改变受入；没有额外条件时不必强行排出高低。' },
  },
  {
    scenario: 'single-guest-wind',
    hand: '123p456s24m05p2z1s8m9s', answerTiles: ['2z'],
    title: '只有一张客风', prompt: '字牌只有一张南；它与数牌浮牌相比谁更孤立？',
    context: { roundWind: '1z', seatWind: '3z', doraIndicator: '7p' },
    explanation: { summary: '南既不是场风也不是自风，只有摸到第二张才能继续发展；先切南保留数牌的顺子变化。', bestPartition: ['123', '456', '24', '55', '1', '8', '9'], contrast: '孤立数牌仍可能从两侧形成搭子，单张客风的变化最少。' },
  },
  {
    scenario: 'three-winds',
    hand: '123p456s24m05p1z2z4z9s', answerTiles: ['2z', '4z'],
    title: '多张风牌的取舍', prompt: '三张不同风牌同时存在，先找出有役牌价值的一张。',
    context: { roundWind: '1z', seatWind: '3z', doraIndicator: '7p' },
    explanation: { summary: '东是场风，南和北都是客风；只看当前条件，南或北都应先于东离开。', bestPartition: ['123', '456', '24', '55', '东', '南或北', '9'], contrast: '字牌数量变多时仍逐张检查身份，不要把三张风牌当成同一种价值。' },
  },
  {
    scenario: 'honor-pair',
    hand: '123p456s24m05p33z8m9s', answerTiles: ['8m', '9s'],
    title: '客风成对后价值改变', prompt: '西已经有两张；此时还应该把它当作最弱孤立牌吗？',
    explanation: { summary: '西虽然是客风，但已经成对，可以直接作雀头，也只差一张成为刻子；此时应切孤立的8万或9条。', bestPartition: ['123', '456', '24', '55', '西西', '8或9'], contrast: '“客风先切”只适用于单张。张数改变后必须重新评价结构。' },
  },
]

function mirrorRank(digit: string): string {
  if (digit === '0') return '0'
  return String(10 - Number(digit))
}

function transformDigits(value: string, transform: Transform, sort = true): string {
  if (transform.rank === 'identity') return value
  const digits = [...value].map(mirrorRank)
  return sort ? digits.sort((a, b) => (a === '0' ? 5 : Number(a)) - (b === '0' ? 5 : Number(b))).join('') : digits.join('')
}

function transformTile(code: TileCode, transform: Transform): TileCode {
  const suit = code[1]
  if (suit === 'z') return `${transform.honors[code[0] as HonorRank]}z` as TileCode
  return `${transformDigits(code[0], transform, false)}${transform.map[suit as NumberSuit]}` as TileCode
}

function transformNotation(notation: string, transform: Transform): string {
  return notation.replace(/([0-9]+)([mpsz])/g, (_, digits: string, suit: string) => {
    if (suit === 'z') return `${[...digits].map((digit) => transform.honors[digit as HonorRank]).sort().join('')}z`
    return `${transformDigits(digits, transform)}${transform.map[suit as NumberSuit]}`
  })
}

function replaceSimultaneously(text: string, source: string[], target: string[]): string {
  return text.replace(new RegExp(`[${source.join('')}]`, 'g'), (value) => target[source.indexOf(value)])
}

function transformText(text: string, transform: Transform): string {
  const suitNames: Record<NumberSuit, string> = { m: '万', p: '饼', s: '条' }
  const honorNames = ['东', '南', '西', '北', '白', '发', '中']
  let result = replaceSimultaneously(text, ['万', '饼', '条'], [suitNames[transform.map.m], suitNames[transform.map.p], suitNames[transform.map.s]])
  result = replaceSimultaneously(result, honorNames, ['1', '2', '3', '4', '5', '6', '7'].map((rank) => honorNames[Number(transform.honors[rank as HonorRank]) - 1]))
  return result.replace(/[0-9]+/g, (digits) => transformDigits(digits, transform))
}

function scenarioSeed(seed: Question, index: number): Question {
  if (seed.principleId !== 'TE-ISO-001') return seed
  const { scenario: _scenario, ...override } = isolationScenarios[index]
  return { ...seed, ...override, context: override.context ?? seed.context, explanation: override.explanation ?? seed.explanation }
}

function generate(original: Question, transform: Transform, index: number): Question {
  const seed = scenarioSeed(original, index)
  const scenario = original.principleId === 'TE-ISO-001' ? isolationScenarios[index].scenario : `${transform.rank}-honors-${transform.id}`
  return {
    ...seed,
    id: index === 0 ? original.id : `${original.id}-${transform.id}`,
    title: transformText(seed.title, transform),
    prompt: transformText(seed.prompt, transform),
    hand: transformNotation(seed.hand, transform),
    drawnTile: transformTile(seed.drawnTile, transform),
    suitOrder: seed.suitOrder.map((suit) => transform.map[suit]) as unknown as Question['suitOrder'],
    dragonOrder: ['5z', '6z', '7z'],
    context: {
      roundWind: transformTile(seed.context.roundWind, transform) as Question['context']['roundWind'],
      seatWind: transformTile(seed.context.seatWind, transform) as Question['context']['seatWind'],
      doraIndicator: transformTile(seed.context.doraIndicator, transform),
    },
    segments: seed.segments.map((segment) => ({ ...segment, suit: transform.map[segment.suit], pattern: transformDigits(segment.pattern, transform) })),
    answerTiles: seed.answerTiles.map((tile) => transformTile(tile, transform)),
    explanation: {
      summary: transformText(seed.explanation.summary, transform),
      bestPartition: seed.explanation.bestPartition.map((part) => transformText(part, transform)),
      contrast: transformText(seed.explanation.contrast, transform),
    },
    tags: seed.tags.map((tag) => transformText(tag, transform)),
    generation: { templateId: original.id, generatorVersion: VERSION, suitTransform: transform.id, rankTransform: transform.rank, scenario },
  }
}

const generated = seeds.flatMap((seed) => transforms.map((transform, index) => generate(seed, transform, index)))
const output = resolve('src/content/generated-questions.json')
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(generated, null, 2)}\n`, 'utf8')
console.log(`Generated ${generated.length} static questions with ${VERSION}`)
