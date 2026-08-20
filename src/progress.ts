export interface ProgressState {
  attempts: Record<string, number>
  correct: Record<string, boolean>
  wrong: string[]
}

const STORAGE_KEY = 'majo-efficiency-progress-v1'
export const EMPTY_PROGRESS: ProgressState = { attempts: {}, correct: {}, wrong: [] }

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_PROGRESS
    const value = JSON.parse(raw) as Partial<ProgressState>
    return {
      attempts: value.attempts ?? {},
      correct: value.correct ?? {},
      wrong: Array.isArray(value.wrong) ? value.wrong : [],
    }
  } catch {
    return EMPTY_PROGRESS
  }
}

export function recordAnswer(progress: ProgressState, questionId: string, isCorrect: boolean): ProgressState {
  const wrong = new Set(progress.wrong)
  if (isCorrect) wrong.delete(questionId)
  else wrong.add(questionId)
  const next = {
    attempts: { ...progress.attempts, [questionId]: (progress.attempts[questionId] ?? 0) + 1 },
    correct: { ...progress.correct, [questionId]: isCorrect || progress.correct[questionId] === true },
    wrong: [...wrong],
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function resetProgress(): ProgressState {
  localStorage.removeItem(STORAGE_KEY)
  return EMPTY_PROGRESS
}
