import { describe, expect, it } from 'vitest'
import { ruleLessons, rulePhases, totalRuleQuestions } from './course'

describe('rule course content', () => {
  it('uses a slower fourteen-lesson quick start and adds the detailed curriculum', () => {
    const quickIds = new Set(rulePhases.slice(0, 3).flatMap((phase) => phase.lessonIds))
    const quick = ruleLessons.filter((lesson) => quickIds.has(lesson.id))
    expect(quick).toHaveLength(14)
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

  it('teaches every detailed lesson before asking questions', () => {
    const detailedIds = new Set(rulePhases.slice(3).flatMap((phase) => phase.lessonIds))
    const detailed = ruleLessons.filter((lesson) => detailedIds.has(lesson.id))
    expect(detailed).toHaveLength(11)
    expect(detailed.every((lesson) => lesson.studySections?.length)).toBe(true)
    expect(detailed.flatMap((lesson) => lesson.studySections ?? []).flatMap((section) => section.items).length).toBeGreaterThan(80)
    const commonYaku = detailed.find((lesson) => lesson.id === 'common-yaku')
    expect(commonYaku?.studySections?.flatMap((section) => section.items).map((item) => item.title)).toEqual(expect.arrayContaining(['立直', '门前清自摸和', '断幺九', '平和', '役牌', '赤宝牌']))
  })

  it('keeps the key furiten example explicit', () => {
    const furiten = ruleLessons.find((lesson) => lesson.id === 'furiten')
    expect(furiten?.keyPoint).toContain('整组等待')
    expect(furiten?.questions[0].prompt).toContain('23万')
    expect(furiten?.questions[0].prompt).toContain('1万和4万')
    expect(furiten?.questions).toHaveLength(4)
    const pass = ruleLessons.find((lesson) => lesson.id === 'furiten-pass')
    expect(pass?.questions).toHaveLength(3)
    expect(pass?.keyPoint).toContain('下一次摸牌后恢复')
  })

  it('introduces the core rule terms one small lesson at a time', () => {
    expect(rulePhases[0].lessonIds).toEqual([
      'yaku-gate',
      'calling-basics',
      'closed-riichi',
      'dora',
      'furiten',
      'furiten-pass',
    ])

    const firstLesson = ruleLessons.find((lesson) => lesson.id === 'yaku-gate')
    expect(firstLesson).toBeDefined()
    expect(JSON.stringify(firstLesson)).not.toMatch(/宝牌|振听|门清|鸣牌|副露/)
  })
})
