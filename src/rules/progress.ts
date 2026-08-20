export interface RuleProgressState {
  completedLessons: string[]
  correct: Record<string, boolean>
  attempts: Record<string, number>
}

const STORAGE_KEY = 'majo-rule-course-progress-v2'
export const EMPTY_RULE_PROGRESS: RuleProgressState = { completedLessons: [], correct: {}, attempts: {} }

export function loadRuleProgress(): RuleProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_RULE_PROGRESS
    const stored = JSON.parse(raw) as Partial<RuleProgressState>
    return {
      completedLessons: Array.isArray(stored.completedLessons) ? stored.completedLessons : [],
      correct: stored.correct ?? {},
      attempts: stored.attempts ?? {},
    }
  } catch {
    return EMPTY_RULE_PROGRESS
  }
}

function save(progress: RuleProgressState): RuleProgressState {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  return progress
}

export function recordRuleAnswer(progress: RuleProgressState, questionId: string, correct: boolean): RuleProgressState {
  return save({
    ...progress,
    correct: { ...progress.correct, [questionId]: correct || progress.correct[questionId] === true },
    attempts: { ...progress.attempts, [questionId]: (progress.attempts[questionId] ?? 0) + 1 },
  })
}

export function completeRuleLesson(progress: RuleProgressState, lessonId: string): RuleProgressState {
  if (progress.completedLessons.includes(lessonId)) return progress
  return save({ ...progress, completedLessons: [...progress.completedLessons, lessonId] })
}

export function resetRuleProgress(): RuleProgressState {
  localStorage.removeItem(STORAGE_KEY)
  return EMPTY_RULE_PROGRESS
}
