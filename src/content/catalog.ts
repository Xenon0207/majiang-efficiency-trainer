import raw from './generated-questions.json'
import type { Question } from './types'

export const questions = raw as unknown as Question[]
