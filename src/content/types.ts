import type { NumberSuit, SuitOrder, TileCode } from '../domain/tiles'
import type { ShapeSegmentSpec } from '../decomposition/rules'

export interface QuestionContext {
  roundWind: '1z' | '2z'
  seatWind: '1z' | '2z' | '3z' | '4z'
  doraIndicator: TileCode
}

export interface Question {
  id: string
  principleId: string
  title: string
  prompt: string
  hand: string
  drawnTile: TileCode
  suitOrder: SuitOrder
  dragonOrder: readonly ['5z', '6z', '7z']
  context: QuestionContext
  segments: ShapeSegmentSpec[]
  answerTiles: TileCode[]
  explanation: {
    summary: string
    bestPartition: string[]
    contrast: string
  }
  sourcePages: number[]
  tags: string[]
  generation?: {
    templateId: string
    generatorVersion: string
    suitTransform: string
    rankTransform?: 'identity' | 'mirror'
    scenario?: string
  }
}

export interface Principle {
  id: string
  order: number
  title: string
  sourcePages: number[]
  summary: string
  exceptions: string[]
}

export function suitName(suit: NumberSuit): string {
  return ({ m: '万', p: '饼', s: '条' } as const)[suit]
}
