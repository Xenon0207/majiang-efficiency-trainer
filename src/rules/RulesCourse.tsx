import { useMemo, useState } from 'react'
import { MahjongTile as Tile } from '../components/MahjongTile'
import { ruleLessons, rulePhases, type RuleChoice, type RuleLesson, type RuleQuestion } from './course'
import type { RuleProgressState } from './progress'

function shuffledChoices<T>(choices: readonly T[]): T[] {
  const result = [...choices]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function TileStrip({ tiles, label }: { tiles: RuleQuestion['tiles']; label?: string }) {
  if (!tiles?.length) return null
  return (
    <div className="rule-tile-example">
      {label && <span>{label}</span>}
      <div className="rule-tiles">{tiles.map((tile, index) => <Tile tile={tile} key={`${tile}-${index}`} />)}</div>
    </div>
  )
}

function QuestionVisual({ question }: { question: RuleQuestion }) {
  return (
    <div className="rule-question-visual">
      <TileStrip tiles={question.tiles} label="相关牌" />
      {question.river && <TileStrip tiles={question.river} label="你的牌河" />}
      {question.doraIndicator && (
        <div className="rule-dora-example">
          <span>宝牌指示牌</span>
          <Tile tile={question.doraIndicator} />
          <i>→</i>
          <span>宝牌？</span>
        </div>
      )}
    </div>
  )
}

export function RulesCatalog({ progress, onBack, onStartLesson, scope = 'quick' }: {
  progress: RuleProgressState
  onBack: () => void
  onStartLesson: (lessonId: string) => void
  scope?: 'quick' | 'detailed'
}) {
  const phases = scope === 'quick' ? rulePhases.slice(0, 3) : rulePhases.slice(3)
  const lessons = phases.flatMap((phase) => phase.lessonIds.map((id) => ruleLessons.find((lesson) => lesson.id === id)!))
  const lessonQuestionIds = new Set(lessons.flatMap((lesson) => lesson.questions.map((question) => question.id)))
  const correct = Object.entries(progress.correct).filter(([id, value]) => value && lessonQuestionIds.has(id)).length
  const questionCount = lessons.reduce((sum, lesson) => sum + lesson.questions.length, 0)
  const completedCount = lessons.filter((lesson) => progress.completedLessons.includes(lesson.id)).length
  return (
    <main className="app-shell lesson-shell course-catalog-shell">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="返回首页">‹</button>
        <div className="continuous-top-title"><strong>{scope === 'quick' ? '日麻规则入门' : '详细规则与算分'}</strong><span>{scope === 'quick' ? '为熟悉其他麻将的玩家准备' : '完整役种 · 点数 · 牌桌细节'}</span></div>
        <span className="version-pill">规则</span>
      </header>
      <article className="lesson-card course-catalog-card rules-catalog-card">
        <span className="eyebrow">{scope === 'quick' ? '先懂规则，再练牌效' : '快速上手之后继续'}</span>
        <h1>{scope === 'quick' ? '日麻真正不同在哪里' : '把规则学完整，但仍按实战频率'}</h1>
        <p className="prompt">{scope === 'quick' ? '为会打川麻或国标的玩家准备：不从牌名讲起，只改掉会妨碍日麻上手的关键习惯。' : '采用雀魂四人麻将规则。高频役反复练，罕见役只需认识；算分从数百道题库中每次抽取短练。'}</p>

        <div className="rules-overview">
          <div><span>课程</span><strong>{completedCount}<small> / {lessons.length}</small></strong></div>
          <div><span>答对过</span><strong>{correct}<small> / {questionCount}</small></strong></div>
          <p>{scope === 'quick' ? '重点概念会换场景反复出现' : '大题库课程每次只抽取12题，适合反复短练'} · 共 {questionCount} 道题</p>
        </div>

        {phases.map((phase) => (
          <section className="course-list catalog-course-list rule-phase-section" key={phase.id}>
            <div className="rule-phase-heading"><span>{phase.eyebrow}</span><strong>{phase.title}</strong><p>{phase.goal}</p></div>
            {phase.lessonIds.map((lessonId) => {
              const lesson = ruleLessons.find((item) => item.id === lessonId)!
              const completed = progress.completedLessons.includes(lesson.id)
              const answered = lesson.questions.filter((question) => progress.attempts[question.id]).length
              const questionLabel = lesson.poolLabel ?? `${lesson.questions.length}题`
              return (
                <button className="course-item" onClick={() => onStartLesson(lesson.id)} key={lesson.id}>
                  <span className={`course-number ${completed ? 'done' : answered ? 'tried' : ''}`}>{completed ? '✓' : lesson.order}</span>
                  <div><strong>{lesson.title}</strong><span>{completed ? '已完成' : answered ? `${answered} 道已作答 · ${questionLabel}` : `${lesson.subtitle} · ${questionLabel}`}</span></div>
                  <i>›</i>
                </button>
              )
            })}
          </section>
        ))}
      </article>
    </main>
  )
}

function RuleIntro({ lesson, onStart }: { lesson: RuleLesson; onStart: () => void }) {
  return (
    <>
      <span className="eyebrow">规则 {lesson.order} · {lesson.subtitle}</span>
      <h1>{lesson.title}</h1>
      <p className="prompt">{lesson.intro}</p>
      <section className="rule-contrast-card">
        <div><span>你可能会这样想</span><p>{lesson.habit}</p></div>
        <div><span>日麻这里不同</span><p>{lesson.difference}</p></div>
      </section>
      <section className="rule-reading-card">
        <ul>{lesson.points.map((point) => <li key={point}>{point}</li>)}</ul>
        <div className="rule-memory"><span>记住这一点</span><strong>{lesson.keyPoint}</strong></div>
      </section>
      {lesson.studySections?.map((section) => (
        <section className="rule-study-section" key={section.title}>
          <div className="rule-study-heading"><span>课前讲义</span><h2>{section.title}</h2>{section.intro && <p>{section.intro}</p>}</div>
          <div className="rule-study-grid">
            {section.items.map((item) => (
              <article className="rule-study-item" key={`${section.title}-${item.title}`}>
                <div><strong>{item.title}</strong>{item.badge && <span>{item.badge}</span>}</div>
                <p>{item.body}</p>
                {item.note && <small>{item.note}</small>}
              </article>
            ))}
          </div>
        </section>
      ))}
      {lesson.example && (
        <section className="rule-example-card">
          <span>{lesson.example.label}</span>
          <div className="rule-tiles">{lesson.example.tiles.map((tile, index) => <Tile tile={tile} key={`${tile}-${index}`} />)}</div>
          <p>{lesson.example.caption}</p>
        </section>
      )}
      <aside className="rule-terms"><span>最后认识术语</span><p>{lesson.terms}</p></aside>
      <button className="primary-button full rule-start-button" onClick={onStart}>开始 {lesson.sessionSize ?? lesson.questions.length} 道场景题<span>→</span></button>
    </>
  )
}

function RuleQuizQuestion({ question, number, total, onAnswered, onNext, isLast }: {
  question: RuleQuestion
  number: number
  total: number
  onAnswered: (correct: boolean) => void
  onNext: () => void
  isLast: boolean
}) {
  const choices = useMemo(() => shuffledChoices(question.choices), [question])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)
  const multiple = question.selectionMode === 'multiple'
  const correctIds = choices.filter((choice) => choice.correct).map((choice) => choice.id)
  const isCorrect = selectedIds.length === correctIds.length && correctIds.every((id) => selectedIds.includes(id))

  function choose(choice: RuleChoice) {
    if (revealed) return
    if (multiple) {
      setSelectedIds((current) => current.includes(choice.id) ? current.filter((id) => id !== choice.id) : [...current, choice.id])
      return
    }
    setSelectedIds([choice.id])
    setRevealed(true)
    onAnswered(choice.correct)
  }

  function submitMultiple() {
    if (!selectedIds.length || revealed) return
    setRevealed(true)
    onAnswered(isCorrect)
  }

  return (
    <section className="rule-quiz-card">
      <span className="eyebrow">场景题 {number} / {total}</span>
      <h1>{question.prompt}</h1>
      {multiple && <p className="rule-multi-note">可多选 · 选好后确认</p>}
      {question.note && <p className="prompt">{question.note}</p>}
      <QuestionVisual question={question} />
      <div className="rule-choices">
        {choices.map((choice) => {
          const picked = selectedIds.includes(choice.id)
          const state = revealed ? choice.correct ? 'correct' : picked ? 'wrong' : 'dimmed' : picked ? 'selected' : ''
          return <button className={state} onClick={() => choose(choice)} key={choice.id}><span>{choice.label}</span>{revealed && choice.correct && <i>✓</i>}{state === 'wrong' && <i>×</i>}</button>
        })}
      </div>
      {multiple && !revealed && <button className="primary-button full rule-multi-submit" disabled={!selectedIds.length} onClick={submitMultiple}>确认选择</button>}
      {revealed && (
        <div className={`rule-feedback ${isCorrect ? 'correct' : 'wrong'}`} aria-live="polite">
          <strong>{isCorrect ? '判断正确' : '这里容易混淆'}</strong>
          <p>{choices.find((choice) => choice.correct)?.explanation}</p>
          {!isCorrect && <p className="correct-answer">正确答案：{choices.filter((choice) => choice.correct).map((choice) => choice.label).join('、')}</p>}
          <button className="primary-button full" onClick={onNext}>{isLast ? '查看本课小结' : '下一题'}</button>
        </div>
      )}
    </section>
  )
}

export function RuleLessonScreen({ lesson, onBack, onAnswered, onComplete }: {
  lesson: RuleLesson
  onBack: () => void
  onAnswered: (questionId: string, correct: boolean) => void
  onComplete: (lessonId: string) => void
}) {
  const [activeQuestions] = useState(() => {
    if (!lesson.sessionSize || lesson.sessionSize >= lesson.questions.length) return [...lesson.questions]
    return shuffledChoices(lesson.questions).slice(0, lesson.sessionSize)
  })
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'done'>('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const question = activeQuestions[questionIndex]
  const progress = phase === 'intro' ? 0 : phase === 'done' ? 100 : ((questionIndex + 1) / activeQuestions.length) * 100

  function nextQuestion() {
    if (questionIndex + 1 < activeQuestions.length) {
      setQuestionIndex((value) => value + 1)
      return
    }
    onComplete(lesson.id)
    setPhase('done')
  }

  return (
    <main className="app-shell lesson-shell rule-lesson-shell">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="返回规则课程">‹</button>
        <div className="progress-title"><span>第 {lesson.order} 课 · {lesson.title}</span><div><i style={{ width: `${progress}%` }} /></div></div>
        <span className="version-pill">规则</span>
      </header>
      <article className="lesson-card rule-lesson-card">
        {phase === 'intro' && <RuleIntro lesson={lesson} onStart={() => setPhase('quiz')} />}
        {phase === 'quiz' && (
          <RuleQuizQuestion
            key={question.id}
            question={question}
            number={questionIndex + 1}
            total={activeQuestions.length}
            isLast={questionIndex + 1 === activeQuestions.length}
            onAnswered={(correct) => {
              if (correct) setCorrectCount((value) => value + 1)
              onAnswered(question.id, correct)
            }}
            onNext={nextQuestion}
          />
        )}
        {phase === 'done' && (
          <section className="rule-complete">
            <span>✓</span>
            <p className="eyebrow">本课完成</p>
            <h1>{lesson.title}</h1>
            <strong>{correctCount} / {activeQuestions.length} 道首次判断正确</strong>
            <div className="rule-memory"><span>带走这一句</span><strong>{lesson.keyPoint}</strong></div>
            <button className="primary-button full" onClick={onBack}>返回规则课程<span>→</span></button>
          </section>
        )}
      </article>
    </main>
  )
}
