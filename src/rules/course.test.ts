import { describe, expect, it } from 'vitest'
import { ruleLessons, rulePhases, totalRuleQuestions } from './course'

describe('rule course content', () => {
  it('keeps the twelve-lesson quick start and adds the detailed curriculum', () => {
    expect(ruleLessons.slice(0, 12)).toHaveLength(12)
    expect(ruleLessons.length).toBeGreaterThan(20)
    expect(rulePhases.slice(0, 3)).toHaveLength(3)
    expect(rulePhases.length).toBeGreaterThanOrEqual(6)
    expect(totalRuleQuestions).toBeGreaterThanOrEqual(400)
    expect(ruleLessons.map((lesson) => lesson.order)).toEqual(ruleLessons.map((_, index) => index + 1))
    const phaseLessonIds = rulePhases.flatMap((phase) => phase.lessonIds)
    expect(new Set(phaseLessonIds).size).toBe(ruleLessons.length)
    expect(new Set(phaseLessonIds)).toEqual(new Set(ruleLessons.map((lesson) => lesson.id)))
  })

  it('uses unique ids and valid single/multiple-answer questions', () => {
    const lessonIds = ruleLessons.map((lesson) => lesson.id)
    const questions = ruleLessons.flatMap((lesson) => lesson.questions)
    const questionIds = questions.map((question) => question.id)
    expect(new Set(lessonIds).size).toBe(lessonIds.length)
    expect(new Set(questionIds).size).toBe(questionIds.length)
    for (const question of questions) {
      if (question.selectionMode === 'multiple') expect(question.choices.filter((choice) => choice.correct).length).toBeGreaterThan(1)
      else expect(question.choices.filter((choice) => choice.correct)).toHaveLength(1)
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(question.choices.length)
    }
  })

  it('provides three large scoring pools sampled in short sessions', () => {
    const scoring = ruleLessons.filter((lesson) => lesson.id.startsWith('score-'))
    expect(scoring.map((lesson) => lesson.questions.length)).toEqual([100, 120, 80])
    expect(scoring.every((lesson) => lesson.sessionSize === 12)).toBe(true)
  })

  it('keeps the key furiten example explicit', () => {
    const furiten = ruleLessons.find((lesson) => lesson.id === 'furiten')
    expect(furiten?.keyPoint).toContain('整组等待')
    expect(furiten?.questions[0].prompt).toContain('23万')
    expect(furiten?.questions[0].prompt).toContain('1万和4万')
    expect(furiten?.questions.length).toBeGreaterThanOrEqual(7)
  })
})
