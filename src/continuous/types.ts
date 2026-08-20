import type { DragonOrder, SuitOrder, TileCode } from '../domain/tiles'
import type { QuestionContext } from '../content/types'

export type RouteFocus = 'mixed' | 'standard' | 'chiitoi' | 'kokushi'

export interface ContinuousSession {
  id: string
  title: string
  routeFocus: RouteFocus
  initialTiles: TileCode[]
  wall: TileCode[]
  suitOrder: SuitOrder
  dragonOrder: DragonOrder
  context: QuestionContext
  generation: {
    seed: number
    generatorVersion: string
  }
}
