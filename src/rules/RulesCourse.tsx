import { useMemo, useState } from 'react'
import { MahjongTile as Tile } from '../components/MahjongTile'
import { ruleLessons, rulePhases, totalRuleQuestions, type RuleChoice, type RuleLesson, type RuleQuestion } from './course'
import type { RuleProgressState } from './progress'

function shuffledChoices(choices: readonly RuleChoice[]): RuleChoice[] {
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

export function RulesCatalog({ progress, onBack, onStartLesson }: {
  progress: RuleProgressState
  onBack: () => void
  onStartLesson: (lessonId: string) => void
}) {
  const correct = Object.values(progress.correct).filter(Boolean).length
  return (
    <main className="app-shell lesson-shell course-catalog-shell">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="返回首页">‹</button>
        <div className="continuous-top-title"><strong>日麻规则入门</strong><span>为熟悉其他麻将的玩家准备</span></div>
        <span className="version-pill">规则</span>
      </header>
      <article className="lesson-card course-catalog-card rules-catalog-card">
        <span className="eyebrow">先懂规则，再练牌效</span>
        <h1>日麻真正不同在哪里</h1>
        <p className="prompt">为会打川麻或国标的玩家准备：不从牌名讲起，只改掉会妨碍日麻上手的关键习惯。</p>

        <div className="rules-overview">
          <div><span>课程</span><strong>{progress.completedLessons.length}<small> / {ruleLessons.length}</small></strong></div>
          <div><span>答对过</span><strong>{correct}<small> / {totalRuleQuestions}</small></strong></div>
          <p>重点概念会换场景反复出现 · 共 {totalRuleQuestions} 道题</p>
        </div>

        {rulePhases.map((phase) => (
          <section className="course-list catalog-course-list rule-phase-section" key={phase.id}>
            <div className="rule-phase-heading"><span>{phase.eyebrow}</span><strong>{phase.title}</strong><p>{phase.goal}</p></div>
            {phase.lessonIds.map((lessonId) => {
              const lesson = ruleLessons.find((item) => item.id === lessonId)!
              const completed = progress.completedLessons.includes(lesson.id)
              const answered = lesson.questions.filter((question) => progress.attempts[question.id]).length
              return (
                <button className="course-item" onClick={() => onStartLesson(lesson.id)} key={lesson.id}>
                  <span className={`course-number ${completed ? 'done' : answered ? 'tried' : ''}`}>{completed ? '✓' : lesson.order}</span>
                  <div><strong>{lesson.title}</strong><span>{completed ? '已完成' : answered ? `${answered}/${lesson.questions.length} 道已作答` : `${lesson.subtitle} · ${lesson.questions.length}题`}</span></div>
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
      {lesson.example && (
        <section className="rule-example-card">
          <span>{lesson.example.label}</span>
          <div className="rule-tiles">{lesson.example.tiles.map((tile, index) => <Tile tile={tile} key={`${tile}-${index}`} />)}</div>
          <p>{lesson.example.caption}</p>
        </section>
      )}
      <aside className="rule-terms"><span>最后认识术语</span><p>{lesson.terms}</p></aside>
      <button className="primary-button full rule-start-button" onClick={onStart}>开始 {lesson.questions.length} 道场景题<span>→</span></button>
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = choices.find((choice) => choice.id === selectedId)

  function choose(choice: RuleChoice) {
    if (selectedId) return
    setSelectedId(choice.id)
    onAnswered(choice.correct)
  }

  return (
    <section className="rule-quiz-card">
      <span className="eyebrow">场景题 {number} / {total}</span>
      <h1>{question.prompt}</h1>
      {question.note && <p className="prompt">{question.note}</p>}
      <QuestionVisual question={question} />
      <div className="rule-choices">
        {choices.map((choice) => {
          const revealed = Boolean(selectedId)
          const state = revealed ? choice.correct ? 'correct' : choice.id === selectedId ? 'wrong' : 'dimmed' : ''
          return <button className={state} onClick={() => choose(choice)} key={choice.id}><span>{choice.label}</span>{revealed && choice.correct && <i>✓</i>}{state === 'wrong' && <i>×</i>}</button>
        })}
      </div>
      {selected && (
        <div className={`rule-feedback ${selected.correct ? 'correct' : 'wrong'}`} aria-live="polite">
          <strong>{selected.correct ? '判断正确' : '这里容易混淆'}</strong>
          <p>{selected.explanation}</p>
          {!selected.correct && <p className="correct-answer">正确答案：{choices.find((choice) => choice.correct)?.label}</p>}
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
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'done'>('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const question = lesson.questions[questionIndex]
  const progress = phase === 'intro' ? 0 : phase === 'done' ? 100 : ((questionIndex + 1) / lesson.questions.length) * 100

  function nextQuestion() {
    if (questionIndex + 1 < lesson.questions.length) {
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
            total={lesson.questions.length}
            isLast={questionIndex + 1 === lesson.questions.length}
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
            <strong>{correctCount} / {lesson.questions.length} 道首次判断正确</strong>
            <div className="rule-memory"><span>带走这一句</span><strong>{lesson.keyPoint}</strong></div>
            <button className="primary-button full" onClick={onBack}>返回规则课程<span>→</span></button>
          </section>
        )}
      </article>
    </main>
  )
}
