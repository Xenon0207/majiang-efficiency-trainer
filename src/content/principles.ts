import raw from '../../content/principles/witch-1.0.json'
import type { Principle } from './types'

export const principles = raw.principles as Principle[]
export const principleById = new Map(principles.map((principle) => [principle.id, principle]))
export const sourceInfo = raw.source
