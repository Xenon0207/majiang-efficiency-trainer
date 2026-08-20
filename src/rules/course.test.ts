import { describe, expect, it } from 'vitest'
import { ruleLessons, totalRuleQuestions } from './course'

describe('rule course content', () => {
  it('publishes seven lessons with three questions each', () => {
    expect(ruleLessons).toHaveLength(7)
    expect(totalRuleQuestions).toBe(21)
    expect(ruleLessons.map((lesson) => lesson.order)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const lesson of ruleLessons) expect(lesson.questions).toHaveLength(3)
  })

  it('uses unique ids and exactly one correct answer per question', () => {
    const lessonIds = ruleLessons.map((lesson) => lesson.id)
    const questions = ruleLessons.flatMap((lesson) => lesson.questions)
    const questionIds = questions.map((question) => question.id)
    expect(new Set(lessonIds).size).toBe(lessonIds.length)
    expect(new Set(questionIds).size).toBe(questionIds.length)
    for (const question of questions) {
      expect(question.choices.filter((choice) => choice.correct)).toHaveLength(1)
      expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(question.choices.length)
    }
  })

  it('keeps the key furiten example explicit', () => {
    const furiten = ruleLessons.find((lesson) => lesson.id === 'furiten')
    expect(furiten?.keyPoint).toContain('整组等待')
    expect(furiten?.questions[0].prompt).toContain('23万')
    expect(furiten?.questions[0].prompt).toContain('1万和4万')
  })
})
