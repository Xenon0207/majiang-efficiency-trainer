import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { principleById, principles } from './content/principles'
import { questions } from './content/catalog'
import type { Question } from './content/types'
import {
  doraFromIndicator,
  parseTiles,
  sortTiles,
  tileImage,
  tileLabel,
  type TileCode,
  type TileInstance,
} from './domain/tiles'
import { HandGrid } from './components/HandGrid'
import { MahjongTile as Tile } from './components/MahjongTile'
import { ShapeGuide } from './components/ShapeGuide'
import { arrangeHandByDecomposition, clickDecomposition, createDecompositionState, visibleGroups } from './decomposition/state'
import { buildDisplayPartition } from './decomposition/partition'
import { groupTileIds, resolveShapeSegments } from './decomposition/rules'
import type { HandGroupMark } from './decomposition/hand-grouping'
import { evaluateDiscards } from './solver/evaluate'
import { EMPTY_PROGRESS, loadProgress, recordAnswer, resetProgress, type ProgressState } from './progress'
import { ContinuousTrainer } from './continuous/ContinuousTrainer'
import { createRandomContinuousSession } from './continuous/random-session'
import type { ContinuousSession } from './continuous/types'
import { ruleLessons, rulePhases, totalRuleQuestions } from './rules/course'
import { RuleLessonScreen, RulesCatalog } from './rules/RulesCourse'
import {
  completeRuleLesson,
  EMPTY_RULE_PROGRESS,
  loadRuleProgress,
  recordRuleAnswer,
  resetRuleProgress,
  type RuleProgressState,
} from './rules/progress'

type View = 'home' | 'rules' | 'ruleLesson' | 'courses' | 'lesson' | 'review' | 'continuous'

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function ContextBar({ question }: { question: Question }) {
  const { roundWind, seatWind, doraIndicator } = question.context
  return (
    <div className="context-bar">
      <div><span>场风</span><strong>{tileLabel(roundWind)}</strong></div>
      <div><span>自风</span><strong>{tileLabel(seatWind)}</strong></div>
      <div className="dora-context"><span>宝牌指示牌</span><Tile tile={doraIndicator} compact /><small>宝牌 {tileLabel(doraFromIndicator(doraIndicator))}</small></div>
    </div>
  )
}

function EvaluationTable({ question, selectedTile }: { question: Question; selectedTile: TileCode }) {
  const evaluations = evaluateDiscards(parseTiles(question.hand), question.context.doraIndicator)
  const recommended = new Set(question.answerTiles)
  const rows = [] as typeof evaluations
  const append = (row: typeof evaluations[number] | undefined) => {
    if (row && !rows.some((existing) => existing.discard === row.discard)) rows.push(row)
  }
  question.answerTiles.forEach((answer) => append(evaluations.find((item) => item.discard === answer)))
  append(evaluations.find((item) => item.discard === selectedTile))
  evaluations.filter((item) => !recommended.has(item.discard)).forEach((item) => {
    if (rows.length < 3) append(item)
  })
  return (
    <div className="evaluation-table">
      {rows.slice(0, 3).map((row) => (
        <div className={`evaluation-row ${recommended.has(row.discard) ? 'recommended' : 'comparison'}`} key={row.discard}>
          <div className="discard-cell"><span className="rank-badge">{recommended.has(row.discard) ? '推荐' : row.discard === selectedTile ? '你的选择' : '对比'}</span><Tile tile={row.discard} compact /><strong>切{tileLabel(row.discard)}</strong></div>
          <div><strong>{row.ukeireCount} 枚</strong><span>{row.shanten} 向听</span></div>
          <div className="ukeire-list">
            {row.ukeireTiles.map((tile) => <span key={tile}><Tile tile={tile} compact /><small>×{row.byTile[tile]}</small></span>)}
          </div>
        </div>
      ))}
    </div>
  )
}

function Lesson({ question, number, total, onBack, onNext, onAnswered }: {
  question: Question
  number: number
  total: number
  onBack: () => void
  onNext: () => void
  onAnswered: (correct: boolean) => void
}) {
  const hand = useMemo(() => sortTiles(parseTiles(question.hand), question.suitOrder), [question])
  const [displayHand, setDisplayHand] = useState(hand)
  const segments = useMemo(() => resolveShapeSegments(hand, question.segments), [hand, question])
  const [decomposition, setDecomposition] = useState(() => createDecompositionState(segments))
  const [mode, setMode] = useState<'organize' | 'discard'>('discard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const selected = hand.find((tile) => tile.id === selectedId)
  const correct = selected ? question.answerTiles.some((answer) => answer === selected.code) : false
  const principle = principleById.get(question.principleId)!
  const recommendedDiscard = displayHand.find((tile) => question.answerTiles.includes(tile.code))
  const recommendedPartition = submitted && recommendedDiscard
    ? buildDisplayPartition(displayHand, recommendedDiscard.id, segments)
    : []
  const drag = useRef({ tileId: '', startX: 0, startY: 0, moved: false })
  const handGrid = useRef<HTMLDivElement>(null)
  const tileGroups = useMemo(() => {
    const result = new Map<string, HandGroupMark>()
    for (const segment of segments) {
      const groups = visibleGroups(decomposition, segment)
      if (!groups) continue
      groupTileIds(segment, groups).forEach((ids, groupIndex) => {
        if (ids.length === 1) return
        ids.forEach((tileId) => result.set(tileId, {
          groupId: `${segment.id}-${groupIndex}`,
          status: segment.rule.forced ? 'locked' : 'unlocked',
        }))
      })
    }
    return result
  }, [decomposition, segments])

  function finishDrag() {
    const moved = drag.current.moved
    drag.current.tileId = ''
    if (moved) {
      setDecomposition(createDecompositionState(segments))
      window.setTimeout(() => { drag.current.moved = false }, 0)
    }
  }

  useEffect(() => {
    const cancel = () => finishDrag()
    const cancelOutside = (event: PointerEvent) => {
      if (!drag.current.tileId) return
      const bounds = handGrid.current?.getBoundingClientRect()
      if (bounds && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) finishDrag()
    }
    window.addEventListener('pointermove', cancelOutside, true)
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('pointermove', cancelOutside, true)
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
    }
  }, [])

  function chooseTile(tile: TileInstance) {
    if (submitted) return
    if (drag.current.moved) return
    if (mode === 'organize') {
      setDecomposition((current) => {
        const next = clickDecomposition(current, segments, tile.id)
        setDisplayHand((shown) => arrangeHandByDecomposition(shown, segments, next))
        return next
      })
      return
    }
    setSelectedId(tile.id)
  }

  function beginDrag(tile: TileInstance, event: ReactPointerEvent<HTMLButtonElement>) {
    if (submitted || mode !== 'organize') return
    drag.current = { tileId: tile.id, startX: event.clientX, startY: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (submitted || mode !== 'organize' || !drag.current.tileId) return
    const bounds = handGrid.current?.getBoundingClientRect()
    if (bounds && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
      finishDrag()
      return
    }
    const distance = Math.hypot(event.clientX - drag.current.startX, event.clientY - drag.current.startY)
    if (distance < 9 && !drag.current.moved) return
    drag.current.moved = true
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-tile-id]')
    const targetId = target?.dataset.tileId
    if (!targetId || targetId === drag.current.tileId) return
    setDisplayHand((current) => {
      const sourceIndex = current.findIndex((tile) => tile.id === drag.current.tileId)
      const targetIndex = current.findIndex((tile) => tile.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [moving] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moving)
      return next
    })
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    finishDrag()
  }

  function submit() {
    if (!selected || submitted) return
    setSubmitted(true)
    onAnswered(correct)
  }

  return (
    <main className="app-shell lesson-shell">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="返回课程">‹</button>
        <div className="progress-title"><span>第 {number} / {total} 题</span><div><i style={{ width: `${number / total * 100}%` }} /></div></div>
        <span className="version-pill">1.0</span>
      </header>

      <article className="lesson-card">
        <div className="eyebrow">原则 {principle.order} · {principle.title}</div>
        <h1>{question.title}</h1>
        <p className="prompt">{question.prompt}</p>
        <ContextBar question={question} />

        <div className="hand-label"><span>{mode === 'organize' ? '点击或拖动手牌进行整理' : '选择要切的牌'}</span><small>{mode === 'organize' ? '拖动可自由调整顺序' : '点击一张牌，再在下方确认'}</small></div>
        <HandGrid ref={handGrid} tiles={displayHand} marks={mode === 'organize' ? tileGroups : undefined}>
          {(tile) => (
            <Tile
              tile={tile}
              selected={mode === 'discard' && tile.id === selectedId}
              dimmed={submitted && tile.id !== selectedId}
              action={mode === 'organize' ? '整理' : '选择切牌'}
              onClick={() => chooseTile(tile)}
              onPointerDown={mode === 'organize' ? (event) => beginDrag(tile, event) : undefined}
              onPointerMove={mode === 'organize' ? moveDrag : undefined}
              onPointerEnd={mode === 'organize' ? endDrag : undefined}
              onLostPointerCapture={mode === 'organize' ? finishDrag : undefined}
              key={tile.id}
            />
          )}
        </HandGrid>

        {submitted && <button className="post-answer-sort" onClick={() => setDisplayHand(hand)}>恢复自动理牌顺序</button>}

        {!submitted && mode === 'discard' && (
          <section className="discard-workspace" aria-label="切牌操作">
            <div className="support-actions">
              <button className="organize-entry" onClick={() => setMode('organize')}>整理手牌与分组</button>
              <button className="text-button" onClick={() => setShowHint((value) => !value)}>{showHint ? '收起原则' : '查看原则提示'}</button>
            </div>
            <button className="primary-button full" disabled={!selected} onClick={submit}>{selected ? `确认切 ${tileLabel(selected.code)}` : '先选一张牌'}</button>
          </section>
        )}

        {!submitted && mode === 'organize' && (
          <section className="organize-workspace" aria-label="整理手牌">
            <div className="organize-heading"><div><strong>整理手牌</strong><span>拖动改变顺序；点击牌标记或切换分组</span></div><button onClick={() => setDisplayHand(hand)}>恢复自动理牌</button></div>
            <ShapeGuide segments={segments} state={decomposition} />
            <div className="answer-actions">
              <button className="text-button" onClick={() => setShowHint((value) => !value)}>{showHint ? '收起原则' : '查看原则提示'}</button>
              <button className="primary-button" onClick={() => setMode('discard')}>整理完成，返回切牌</button>
            </div>
          </section>
        )}

        {submitted && (
          <section className={`result-panel ${correct ? 'correct' : 'wrong'}`} aria-live="polite">
            <div className="result-heading"><span>{correct ? '✓' : '×'}</span><div><strong>{correct ? '判断正确' : '再看一步'}</strong><small>{correct ? '你保留了更宽的后续变化。' : `推荐切：${question.answerTiles.map(tileLabel).join(' 或 ')}`}</small></div></div>
            <p>{question.explanation.summary}</p>
            <div className="partition"><span>推荐分割 · 按上方手牌顺序</span><strong>{recommendedPartition.map((group) => `[${group}]`).join(' ')}</strong></div>
            <p className="contrast">对比：{question.explanation.contrast}</p>
            <h2>候选切牌比较</h2>
            <EvaluationTable question={question} selectedTile={selected!.code} />
            <button className="primary-button full" onClick={onNext}>{number === total ? '完成课程' : '下一题'}</button>
          </section>
        )}

        {showHint && !submitted && <aside className="hint"><strong>{principle.title}</strong><p>{principle.summary}</p></aside>}
      </article>
    </main>
  )
}

function CourseCatalog({ progress, onBack, onStartPrinciple, onStartRandom }: {
  progress: ProgressState
  onBack: () => void
  onStartPrinciple: (principleId: string) => void
  onStartRandom: () => void
}) {
  return (
    <main className="app-shell lesson-shell course-catalog-shell">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="返回首页">‹</button>
        <div className="continuous-top-title"><strong>基础课程</strong><span>14 个牌效原则 · 84 道练习</span></div>
        <span className="version-pill">1.0</span>
      </header>
      <article className="lesson-card course-catalog-card">
        <span className="eyebrow">选择练习方式</span>
        <h1>基础牌效课程</h1>
        <p className="prompt">可以按原则逐课练习，也可以从全部基础题中随机出题。</p>

        <button className="course-item random-course-item" onClick={onStartRandom}>
          <span className="course-number random">乱</span>
          <div><strong>随机基础练习</strong><span>打乱全部 84 题 · 混合所有基础原则</span></div>
          <i>›</i>
        </button>

        <section className="course-list catalog-course-list">
          <div className="section-heading"><div><span className="eyebrow">按课程练习</span><h2>14 个牌效原则</h2></div><small>每课 6 题</small></div>
          {principles.map((principle) => {
            const lesson = questions.filter((item) => item.principleId === principle.id)
            const doneCount = lesson.filter((question) => progress.correct[question.id]).length
            const tried = lesson.some((question) => progress.attempts[question.id])
            const done = doneCount === lesson.length
            return <button className="course-item" onClick={() => onStartPrinciple(principle.id)} key={principle.id}><span className={`course-number ${done ? 'done' : tried ? 'tried' : ''}`}>{done ? '✓' : principle.order}</span><div><strong>{principle.title}</strong><span>{doneCount}/{lesson.length} · {lesson[0].tags.join(' · ')}</span></div><i>›</i></button>
          })}
        </section>
      </article>
    </main>
  )
}

function Home({ progress, ruleProgress, onOpenRules, onOpenCourses, onReview, onReset, onStartContinuous }: {
  progress: ProgressState
  ruleProgress: RuleProgressState
  onOpenRules: () => void
  onOpenCourses: () => void
  onReview: () => void
  onReset: () => void
  onStartContinuous: () => void
}) {
  const completed = Object.values(progress.correct).filter(Boolean).length
  const attempted = Object.keys(progress.attempts).length
  const rulesCorrect = Object.values(ruleProgress.correct).filter(Boolean).length
  const rulesAttempted = Object.keys(ruleProgress.attempts).length
  return (
    <main className="app-shell home-shell">
      <header className="brand"><div className="brand-mark">牌</div><div><strong>牌理小课</strong><span>日麻牌效练习</span></div></header>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow">给新手的一次一切练习</span><h1>先把手牌<br />看清楚，再切。</h1><p>从《魔女BLOG》的牌效原则出发，一题只做一个决定。可以先亲手标记复合形，再比较真正的受入。</p></div>
        <div className="hero-tile"><img src={tileImage('5m')} alt="五万" /><span>循序渐进</span></div>
      </section>
      <section className="rules-entry-card">
        <div className="rules-entry-heading">
          <span className="version-tag">先学</span>
          <div><strong>从川麻 / 国标切换到日麻</strong><p>不从牌名讲起，只改变真正会妨碍上手的习惯。</p></div>
        </div>
        <div className="home-rule-goals">
          {rulePhases.map((phase) => <div key={phase.id}><span>{phase.eyebrow}</span><strong>{phase.title}</strong></div>)}
        </div>
        <div className="rules-entry-progress"><span>{ruleProgress.completedLessons.length} / {ruleLessons.length} 课</span><span>{rulesCorrect} / {totalRuleQuestions} 题答对过</span></div>
        <button className="primary-button full" onClick={onOpenRules}>{rulesAttempted ? '继续规则课程' : '开始规则入门'}<span>→</span></button>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-top"><div><span>课程进度</span><strong>{completed}<small> / {questions.length}</small></strong></div><div className="ring" style={{ '--progress': `${completed / questions.length * 360}deg` } as CSSProperties}><span>{Math.round(completed / questions.length * 100)}%</span></div></div>
        <button className="primary-button full" onClick={onOpenCourses}>{attempted ? '继续基础课程' : '进入基础课程'}<span>→</span></button>
        {progress.wrong.length > 0 && <button className="secondary-button full" onClick={onReview}>复习错题 · {progress.wrong.length}</button>}
      </section>
      <section className="continuous-entry-card">
        <div><span className="version-tag">连续</span><strong>连续牌效训练</strong><p>每局即时洗出完整随机牌山，从随机散牌连续摸切；普通手、七对子与国士始终动态判断。</p></div>
        <button className="primary-button full" onClick={onStartContinuous}>开始连续训练<span>→</span></button>
      </section>
      {(attempted > 0 || rulesAttempted > 0) && <button className="reset-button" onClick={onReset}>清除本机学习记录</button>}
      <footer>题目与解释为原创改编 · 牌面来自 FluffyStuff / riichi-mahjong-tiles</footer>
    </main>
  )
}

function App() {
  const [view, setView] = useState<View>('home')
  const [index, setIndex] = useState(0)
  const [run, setRun] = useState<number[]>(questions.map((_, i) => i))
  const [runPosition, setRunPosition] = useState(0)
  const [progress, setProgress] = useState<ProgressState>(() => typeof localStorage === 'undefined' ? EMPTY_PROGRESS : loadProgress())
  const [ruleProgress, setRuleProgress] = useState<RuleProgressState>(() => typeof localStorage === 'undefined' ? EMPTY_RULE_PROGRESS : loadRuleProgress())
  const [ruleLessonId, setRuleLessonId] = useState(ruleLessons[0].id)
  const [continuousSession, setContinuousSession] = useState<ContinuousSession | null>(null)

  function startRandomBasics() {
    const indices = shuffled(questions.map((_, questionIndex) => questionIndex))
    setRun(indices)
    setRunPosition(0)
    setIndex(indices[0])
    setView('lesson')
  }

  function startPrinciple(principleId: string) {
    const indices = shuffled(questions.map((question, questionIndex) => ({ question, questionIndex })).filter(({ question }) => question.principleId === principleId).map(({ questionIndex }) => questionIndex))
    setRun(indices)
    setRunPosition(0)
    setIndex(indices[0])
    setView('lesson')
  }

  function startReview() {
    const indices = shuffled(progress.wrong.map((id) => questions.findIndex((question) => question.id === id)).filter((value) => value >= 0))
    if (!indices.length) return
    setRun(indices)
    setRunPosition(0)
    setIndex(indices[0])
    setView('review')
  }

  function next() {
    if (runPosition + 1 >= run.length) {
      setView(view === 'review' ? 'home' : 'courses')
      return
    }
    const nextPosition = runPosition + 1
    setRunPosition(nextPosition)
    setIndex(run[nextPosition])
  }

  function startContinuous() {
    setContinuousSession(createRandomContinuousSession())
    setView('continuous')
  }

  if (view === 'lesson' || view === 'review') {
    const question = questions[index]
    return <Lesson key={`${view}-${question.id}-${runPosition}`} question={question} number={runPosition + 1} total={run.length} onBack={() => setView(view === 'review' ? 'home' : 'courses')} onNext={next} onAnswered={(correct) => setProgress((current) => recordAnswer(current, question.id, correct))} />
  }

  if (view === 'courses') {
    return <CourseCatalog progress={progress} onBack={() => setView('home')} onStartPrinciple={startPrinciple} onStartRandom={startRandomBasics} />
  }

  if (view === 'rules') {
    return <RulesCatalog progress={ruleProgress} onBack={() => setView('home')} onStartLesson={(lessonId) => { setRuleLessonId(lessonId); setView('ruleLesson') }} />
  }

  if (view === 'ruleLesson') {
    const lesson = ruleLessons.find((item) => item.id === ruleLessonId) ?? ruleLessons[0]
    return <RuleLessonScreen key={lesson.id} lesson={lesson} onBack={() => setView('rules')} onAnswered={(questionId, correct) => setRuleProgress((current) => recordRuleAnswer(current, questionId, correct))} onComplete={(lessonId) => setRuleProgress((current) => completeRuleLesson(current, lessonId))} />
  }

  if (view === 'continuous' && continuousSession) {
    return <ContinuousTrainer key={continuousSession.id} session={continuousSession} onBack={() => setView('home')} onNewSession={startContinuous} />
  }

  return <Home progress={progress} ruleProgress={ruleProgress} onOpenRules={() => setView('rules')} onOpenCourses={() => setView('courses')} onReview={startReview} onReset={() => { setProgress(resetProgress()); setRuleProgress(resetRuleProgress()) }} onStartContinuous={startContinuous} />
}

export default App
