import generated from '../content/generated-continuous-sessions.json'
import type { ContinuousSession } from './types'

export const continuousSessions = generated as unknown as ContinuousSession[]
