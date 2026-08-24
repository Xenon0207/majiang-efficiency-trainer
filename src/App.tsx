import { useMemo, useState } from 'react'
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
import { HandGroupingGuide } from './components/HandGroupingGuide'
import { MahjongTile as Tile } from './components/MahjongTile'
import { useHandOrganizer } from './components/useHandOrganizer'
import {
  buildHandGroupingModel,
  createHandGroupingState,
  formatGroup,
  selectedSuitPartition,
} from './decomposition/hand-grouping'
import { evaluateDiscards } from './solver/evaluate'
import { EMPTY_PROGRESS, loadProgress, recordAnswer, resetProgress, type ProgressState } from './progress'
import { ContinuousTrainer } from './continuous/ContinuousTrainer'
import { createRandomContinuousSession } from './continuous/random-session'
import type { ContinuousSession } from './continuous/types'
import { ruleLessons, rulePhases } from './rules/course'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const organizer = useHandOrganizer(hand, submitted)
  const { displayHand, grouping, groupingModel, handGrid, mode, tileGroups } = organizer
  const selected = hand.find((tile) => tile.id === selectedId)
  const correct = selected ? question.answerTiles.some((answer) => answer === selected.code) : false
  const principle = principleById.get(question.principleId)!
  const recommendedDiscard = displayHand.find((tile) => question.answerTiles.includes(tile.code))
  const recommendedPartition = submitted && recommendedDiscard
    ? buildHandGroupingModel(displayHand.filter((tile) => tile.id !== recommendedDiscard.id)).suits.flatMap((suit) =>
      selectedSuitPartition(suit, createHandGroupingState()).groups.map((group) => formatGroup(group, suit.suit)),
    )
    : []
  function chooseTile(tile: TileInstance) {
    if (submitted) return
    if (organizer.handleOrganizeTile(tile)) return
    setSelectedId(tile.id)
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
              onPointerDown={mode === 'organize' ? (event) => organizer.beginDrag(tile, event) : undefined}
              onPointerMove={mode === 'organize' ? organizer.moveDrag : undefined}
              onPointerEnd={mode === 'organize' ? organizer.endDrag : undefined}
              onLostPointerCapture={mode === 'organize' ? organizer.finishDrag : undefined}
              key={tile.id}
            />
          )}
        </HandGrid>

        {submitted && <button className="post-answer-sort" onClick={() => organizer.restoreAutoSort(hand)}>恢复自动理牌顺序</button>}

        {!submitted && mode === 'discard' && (
          <section className="discard-workspace" aria-label="切牌操作">
            <div className="support-actions">
              <button className="organize-entry" onClick={() => organizer.setMode('organize')}>整理手牌与分组</button>
              <button className="text-button" onClick={() => setShowHint((value) => !value)}>{showHint ? '收起原则' : '查看原则提示'}</button>
            </div>
            <button className="primary-button full" disabled={!selected} onClick={submit}>{selected ? `确认切 ${tileLabel(selected.code)}` : '先选一张牌'}</button>
          </section>
        )}

        {!submitted && mode === 'organize' && (
          <section className="organize-workspace" aria-label="整理手牌">
            <div className="organize-heading"><div><strong>整理手牌</strong><span>点击后显示全手分组；再点同门任意牌切换方案</span></div><button onClick={() => organizer.restoreAutoSort(hand)}>恢复自动理牌</button></div>
            <HandGroupingGuide model={groupingModel} state={grouping} />
            <div className="answer-actions">
              <button className="text-button" onClick={() => setShowHint((value) => !value)}>{showHint ? '收起原则' : '查看原则提示'}</button>
              <button className="primary-button" onClick={() => organizer.setMode('discard')}>整理完成，返回切牌</button>
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

function Home({ progress, ruleProgress, onOpenRules, onOpenDetailedRules, onOpenCourses, onReview, onReset, onStartContinuous }: {
  progress: ProgressState
  ruleProgress: RuleProgressState
  onOpenRules: () => void
  onOpenDetailedRules: () => void
  onOpenCourses: () => void
  onReview: () => void
  onReset: () => void
  onStartContinuous: () => void
}) {
  const completed = Object.values(progress.correct).filter(Boolean).length
  const attempted = Object.keys(progress.attempts).length
  const rulesAttempted = Object.keys(ruleProgress.attempts).length
  const quickLessonIds = new Set(rulePhases.slice(0, 3).flatMap((phase) => phase.lessonIds))
  const quickLessons = ruleLessons.filter((lesson) => quickLessonIds.has(lesson.id))
  const detailedLessons = ruleLessons.filter((lesson) => !quickLessonIds.has(lesson.id))
  const quickQuestionIds = new Set(quickLessons.flatMap((lesson) => lesson.questions.map((question) => question.id)))
  const quickCorrect = Object.entries(ruleProgress.correct).filter(([id, value]) => value && quickQuestionIds.has(id)).length
  const quickAttempted = Object.keys(ruleProgress.attempts).some((id) => quickQuestionIds.has(id))
  const quickQuestionCount = quickLessons.reduce((sum, lesson) => sum + lesson.questions.length, 0)
  const detailedCompleted = detailedLessons.filter((lesson) => ruleProgress.completedLessons.includes(lesson.id)).length
  return (
    <main className="app-shell home-shell">
      <header className="brand"><div className="brand-mark">牌</div><div><strong>日麻小课</strong><span>规则 · 牌效 · 算分</span></div></header>
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow">从会打麻将，到真正理解日麻</span><h1>懂规则，<br />也懂每一切。</h1><p>从快速规则、基础牌效到连续手牌训练，再逐步进入役种、算分与攻防判断。</p></div>
        <div className="hero-tile"><img src={tileImage('7z')} alt="红中" /><span>循序渐进</span></div>
      </section>
      <div className="home-course-list">
        <section className="home-course-card">
          <div className="home-course-heading"><span className="home-course-index">01</span><div><span className="home-course-kind">上手准备</span><strong>从川麻 / 国标切换到日麻</strong><p>先补齐日麻特有的和牌规则，再带着这些知识进入基础牌效。</p></div></div>
          <div className="home-course-meta"><span>{quickLessons.filter((lesson) => ruleProgress.completedLessons.includes(lesson.id)).length} / {quickLessons.length} 课</span><span>{quickCorrect} / {quickQuestionCount} 题答对过</span></div>
          <button className="primary-button full" onClick={onOpenRules}>{quickAttempted ? '继续规则准备' : '开始规则准备'}<span>→</span></button>
        </section>
        <section className="home-course-card core-course-card">
          <div className="home-course-heading"><span className="home-course-index">02</span><div><span className="home-course-kind">核心练习</span><strong>基础牌效课程</strong><p>一课练清一个牌效原则，一题只做一次选择，再看清受入与分组。</p></div></div>
          <div className="home-course-meta"><span>{completed} / {questions.length} 题完成</span><span>{Math.round(completed / questions.length * 100)}%</span></div>
          <button className="primary-button full" onClick={onOpenCourses}>{attempted ? '继续基础牌效' : '开始基础牌效'}<span>→</span></button>
          {progress.wrong.length > 0 && <button className="secondary-button full" onClick={onReview}>复习错题 · {progress.wrong.length}</button>}
        </section>
        <section className="home-course-card core-course-card">
          <div className="home-course-heading"><span className="home-course-index">03</span><div><span className="home-course-kind">核心练习</span><strong>连续牌效训练</strong><p>把原则放回完整的一手牌：随机牌山、连续摸切，并动态比较普通手、七对子与国士。</p></div></div>
          <div className="home-course-meta"><span>完整随机牌山</span><span>每巡即时计算</span></div>
          <button className="primary-button full" onClick={onStartContinuous}>开始连续牌效<span>→</span></button>
        </section>
        <section className="home-course-card">
          <div className="home-course-heading"><span className="home-course-index">04</span><div><span className="home-course-kind">拓展课程</span><strong>详细规则与算分</strong><p>按实战频率继续学习役种、副露变化、番数和雀魂点数，随时回来补充也可以。</p></div></div>
          <div className="home-course-meta"><span>{detailedCompleted} / {detailedLessons.length} 课</span><span>役种 · 算分 · 实战细节</span></div>
          <button className="primary-button full" onClick={onOpenDetailedRules}>{detailedCompleted ? '继续详细规则' : '学习详细规则'}<span>→</span></button>
        </section>
      </div>
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
  const [ruleScope, setRuleScope] = useState<'quick' | 'detailed'>('quick')
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
    return <RulesCatalog scope={ruleScope} progress={ruleProgress} onBack={() => setView('home')} onStartLesson={(lessonId) => { setRuleLessonId(lessonId); setView('ruleLesson') }} />
  }

  if (view === 'ruleLesson') {
    const lesson = ruleLessons.find((item) => item.id === ruleLessonId) ?? ruleLessons[0]
    return <RuleLessonScreen key={lesson.id} lesson={lesson} onBack={() => setView('rules')} onAnswered={(questionId, correct) => setRuleProgress((current) => recordRuleAnswer(current, questionId, correct))} onComplete={(lessonId) => setRuleProgress((current) => completeRuleLesson(current, lessonId))} />
  }

  if (view === 'continuous' && continuousSession) {
    return <ContinuousTrainer key={continuousSession.id} session={continuousSession} onBack={() => setView('home')} onNewSession={startContinuous} />
  }

  return <Home progress={progress} ruleProgress={ruleProgress} onOpenRules={() => { setRuleScope('quick'); setView('rules') }} onOpenDetailedRules={() => { setRuleScope('detailed'); setView('rules') }} onOpenCourses={() => setView('courses')} onReview={startReview} onReset={() => { setProgress(resetProgress()); setRuleProgress(resetRuleProgress()) }} onStartContinuous={startContinuous} />
}

export default App
