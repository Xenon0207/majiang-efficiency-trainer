import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { HandGrid } from '../components/HandGrid'
import { HandGroupingGuide } from '../components/HandGroupingGuide'
import { MahjongTile } from '../components/MahjongTile'
import { doraFromIndicator, normalizeTile, parseTiles, sortTiles, tileLabel, toCounts, type TileCode, type TileInstance } from '../domain/tiles'
import {
  arrangeHandForGrouping,
  buildHandGroupingModel,
  clickHandGrouping,
  createHandGroupingState,
  formatGroup,
  handGroupMarks,
  selectedSuitPartition,
} from '../decomposition/hand-grouping'
import { calculateRouteShanten } from '../solver/shanten'
import {
  continuousShantenOptions,
  declareKan,
  discardAndDraw,
  optimalChoicePercent,
  evaluateKanOptions,
  startContinuousSession,
  type ContinuousState,
  type ContinuousTurn,
  type KanEvaluation,
} from './engine'
import type { DiscardEvaluation } from '../solver/evaluate'
import { compareEvaluationTiles, classifyTurnSolution, heuristicExplanation, type TileDifferenceLine, type TurnSolutionKind } from './feedback'
import type { ContinuousSession } from './types'

function ContextBar({ session, doraIndicators }: { session: ContinuousSession; doraIndicators: readonly TileCode[] }) {
  const { roundWind, seatWind } = session.context
  return (
    <div className="context-bar">
      <div><span>场风</span><strong>{tileLabel(roundWind)}</strong></div>
      <div><span>自风</span><strong>{tileLabel(seatWind)}</strong></div>
      <div className="dora-context multi-dora"><span>宝牌指示牌</span><div>{doraIndicators.map((tile, index) => <MahjongTile tile={tile} compact key={`${tile}-${index}`} />)}</div><small>宝牌 {doraIndicators.map((tile) => tileLabel(doraFromIndicator(tile))).join('、')}</small></div>
    </div>
  )
}

type QualityEvaluation = DiscardEvaluation | KanEvaluation

function formatEfficiencyCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function UkeireNumbers({ evaluation }: { evaluation: QualityEvaluation }) {
  return evaluation.furiten ? (
    <>
      <strong>有效 {formatEfficiencyCount(evaluation.effectiveUkeireCount)} 枚</strong>
      <span>实际 {evaluation.ukeireCount} 枚 · 振听 × 1/4</span>
    </>
  ) : <strong>{evaluation.ukeireCount} 枚</strong>
}

function ukeireSummary(evaluation: QualityEvaluation): string {
  return evaluation.furiten
    ? `有效受入 ${formatEfficiencyCount(evaluation.effectiveUkeireCount)} 枚（实际 ${evaluation.ukeireCount} 枚，振听 × 1/4）`
    : `受入 ${evaluation.ukeireCount} 枚`
}

function UkeireTiles({ tiles, byTile }: { tiles: readonly TileCode[]; byTile: Record<string, number> }) {
  if (tiles.length === 0) return <span className="empty-ukeire">无</span>
  return <>{tiles.map((tile) => <span key={tile}><MahjongTile tile={tile} compact /><small>×{byTile[tile]}</small></span>)}</>
}

function QualityUkeire({ evaluation, expanded }: { evaluation: QualityEvaluation; expanded: boolean }) {
  if (!evaluation.qualityCalculated) return <div className="ukeire-list"><UkeireTiles tiles={evaluation.ukeireTiles} byTile={evaluation.byTile} /></div>
  if (!expanded) return (
    <div className="compact-transition-summary">
      <div><span className="quality-label advance">降向听</span><div className="ukeire-list"><UkeireTiles tiles={evaluation.ukeireTiles} byTile={evaluation.byTile} /></div></div>
      <div><span className="quality-label good">好型进张</span><div className="ukeire-list"><UkeireTiles tiles={evaluation.goodShapeTiles} byTile={evaluation.shapeByTile} /></div></div>
      {evaluation.goodImprovementTiles.length > 0 && <div><span className="quality-label good-improve">好型改良</span><div className="ukeire-list"><UkeireTiles tiles={evaluation.goodImprovementTiles} byTile={evaluation.shapeByTile} /></div></div>}
      {evaluation.improvementTiles.length > 0 && <small>另有 {evaluation.improvementTiles.length} 种改良 · 点击好型枚数查看</small>}
    </div>
  )
  const goodImprovements = new Set(evaluation.goodImprovementTiles)
  const otherImprovements = evaluation.improvementTiles.filter((tile) => !goodImprovements.has(tile))
  return (
    <div className="quality-ukeire-breakdown">
      <div><span className="quality-label good">好型进张</span><div className="ukeire-list"><UkeireTiles tiles={evaluation.goodShapeTiles} byTile={evaluation.shapeByTile} /></div></div>
      <div><span className="quality-label weak">其他进张</span><div className="ukeire-list"><UkeireTiles tiles={evaluation.badShapeTiles} byTile={evaluation.shapeByTile} /></div></div>
      {evaluation.goodImprovementTiles.length > 0 && <div><span className="quality-label good-improve">好型改良</span><div className="ukeire-list"><UkeireTiles tiles={evaluation.goodImprovementTiles} byTile={evaluation.shapeByTile} /></div></div>}
      {otherImprovements.length > 0 && <div><span className="quality-label improve">其他改良</span><div className="ukeire-list"><UkeireTiles tiles={otherImprovements} byTile={evaluation.shapeByTile} /></div></div>}
    </div>
  )
}

function ShapeCountButton({ evaluation, expanded, onClick }: { evaluation: QualityEvaluation; expanded: boolean; onClick: () => void }) {
  if (!evaluation.qualityCalculated) return <span className="shape-count-skipped" title="非最低向听或受入不在同档，不执行昂贵的次巡好型计算"><span>好型</span><strong>—</strong></span>
  return <button className="shape-count-toggle" aria-expanded={expanded} title="来自现有两面进张或新形成两面的剩余绝对枚数；点击区分降向听、好型改良与其他改良" onClick={onClick}><span>好型</span><strong>{evaluation.goodShapeCount}枚</strong><i>{expanded ? '⌃' : '⌄'}</i></button>
}

function ProgressValue({ evaluation }: { evaluation: QualityEvaluation }) {
  if (evaluation.speedScore === undefined || evaluation.speedDepth === undefined) return null
  return <span title="有限巡内累计降低的期望向听数；越早推进贡献越大">{evaluation.speedDepth}巡推进 {evaluation.speedScore.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</span>
}

function EvaluationExplanation({ evaluation, label }: { evaluation: QualityEvaluation; label?: string }) {
  return (
    <div className="answer-explanation">
      {label && <strong className="answer-explanation-label">{label}</strong>}
      <div className="answer-metrics">
        <span>{evaluation.shanten} 向听</span>
        <span>{ukeireSummary(evaluation)}</span>
        <span>次巡期望 {evaluation.nextUkeireExpectation ?? '—'}</span>
        <ProgressValue evaluation={evaluation} />
        <span>好型 {evaluation.goodShapeCount} 枚</span>
      </div>
      <div className="answer-good-tiles">
        <span>好型进张</span>
        <div className="ukeire-list"><UkeireTiles tiles={evaluation.goodShapeTiles} byTile={evaluation.shapeByTile} /></div>
        {evaluation.goodImprovementTiles.length > 0 && <><span>好型改良</span><div className="ukeire-list"><UkeireTiles tiles={evaluation.goodImprovementTiles} byTile={evaluation.shapeByTile} /></div></>}
      </div>
    </div>
  )
}

const DIFFERENCE_LABELS: Record<TileDifferenceLine['kind'], string> = {
  advance: '降向听进张',
  good: '好型机会',
  improvement: '其他改良',
}

function DifferenceTileList({ tiles, byTile }: {
  tiles: readonly TileCode[]
  byTile: Record<string, number>
}) {
  return <div className="ukeire-list"><UkeireTiles tiles={tiles} byTile={byTile} /></div>
}

function EvaluationDifference({ preferred, chosen }: { preferred: DiscardEvaluation; chosen: DiscardEvaluation }) {
  const differences = compareEvaluationTiles(preferred, chosen)
  const sameShanten = preferred.shanten === chosen.shanten
  return (
    <div className="evaluation-difference">
      <div className="evaluation-difference-heading">
        <strong>两种切法具体差在这里</strong>
        <small>先比较总枚数，再看被哪些牌替换</small>
      </div>
      {!sameShanten && <div className="difference-stage">
        <strong>先看向听：最优 {preferred.shanten} 向听，你的选择 {chosen.shanten} 向听</strong>
        <span>已经相差 {Math.abs(chosen.shanten - preferred.shanten)} 个阶段；下方受入对应不同的推进目标，不能直接比较枚数大小。</span>
      </div>}
      {differences.length > 0 ? <div className="evaluation-difference-lines">{differences.map((difference) => {
        const delta = difference.preferredCount - difference.chosenCount
        const relation = sameShanten ? delta === 0 ? '=' : delta > 0 ? '>' : '<' : '↔'
        const conclusion = !sameShanten ? '不同阶段，仅看牌种差异' : delta === 0 ? '总数相同' : delta > 0 ? `最优多 ${delta} 枚` : `你的选择多 ${Math.abs(delta)} 枚`
        return <div className="evaluation-difference-line" key={difference.kind}>
          <div className="difference-summary">
            <span>{DIFFERENCE_LABELS[difference.kind]}</span>
            <strong><b>最优 {difference.preferredCount}枚</b><i>{relation}</i><b>你的 {difference.chosenCount}枚</b></strong>
            <small>{conclusion}{difference.commonCount > 0 ? ` · 另有 ${difference.commonCount} 枚相同` : ''}</small>
          </div>
          {difference.preferred.length > 0 && <div className="difference-side preferred">
            <small>{sameShanten ? '最优多出' : '最优侧独有'}</small>
            <DifferenceTileList tiles={difference.preferred} byTile={difference.preferredByTile} />
          </div>}
          {difference.chosen.length > 0 && <div className="difference-side chosen">
            <small>{sameShanten ? '你的选择多出' : '你的侧独有'}</small>
            <DifferenceTileList tiles={difference.chosen} byTile={difference.chosenByTile} />
          </div>}
        </div>
      } )}</div> : <p>首层进张牌种与枚数相同；差距来自摸入后重新切牌的路径，请对照上方的次巡期望与两巡推进。</p>}
    </div>
  )
}

function AnswerDiscardRow({ evaluation, badge, tone, expanded, onToggle }: {
  evaluation: DiscardEvaluation
  badge: string
  tone: 'chosen' | 'recommended'
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className={`evaluation-row answer-evaluation-row ${tone}`}>
      <span className="answer-row-badge">{badge}</span>
      <div className="discard-cell"><span className="answer-cut-prefix">切</span><MahjongTile tile={evaluation.discard} compact /></div>
      <div className="evaluation-numbers"><UkeireNumbers evaluation={evaluation} /><span>{evaluation.shanten} 向听</span>{evaluation.nextUkeireExpectation !== undefined && <span>次巡期望 {evaluation.nextUkeireExpectation}</span>}<ProgressValue evaluation={evaluation} />{evaluation.standardShanten !== undefined && evaluation.standardShanten !== evaluation.shanten && <span>面子手 {evaluation.standardShanten} 向听 · {evaluation.standardUkeireCount}枚</span>}</div>
      <ShapeCountButton evaluation={evaluation} expanded={expanded} onClick={onToggle} />
      <QualityUkeire evaluation={evaluation} expanded={expanded} />
    </div>
  )
}

function CandidateRows({ turn, expandedRows, onToggleRow }: { turn: ContinuousTurn; expandedRows: ReadonlySet<string>; onToggleRow: (key: string) => void }) {
  const before = parseTiles(turn.beforeHand.join(''))
  return (
    <div className="evaluation-table continuous-candidates">
      {turn.kanCandidates.map((row) => {
        const rowKey = `kan-${row.tile}`
        const recommended = turn.recommendedKans.includes(row.tile)
        const chosen = turn.action === 'kan' && row.tile === turn.kanTile
        const copies = before.filter((tile) => tile.normalized === normalizeTile(row.tile))
        return (
          <div className={`evaluation-row action-evaluation-row ${recommended ? 'recommended' : 'comparison'}`} key={rowKey}>
            <div className="discard-cell"><span className="rank-badge">{recommended ? '最优' : chosen ? '你的选择' : '对比'}</span><span className="kan-mini-tiles">{copies.map((tile) => <MahjongTile tile={tile} compact key={tile.id} />)}</span><strong>暗杠{tileLabel(row.tile)}</strong></div>
            <div className="evaluation-numbers"><UkeireNumbers evaluation={row} /><span>{row.shanten} 向听</span>{row.nextUkeireExpectation !== undefined && <span>次巡期望 {row.nextUkeireExpectation}</span>}<ProgressValue evaluation={row} />{row.standardShanten !== undefined && row.standardShanten !== row.shanten && <span>面子手 {row.standardShanten} 向听 · {row.standardUkeireCount}枚</span>}</div>
            <ShapeCountButton evaluation={row} expanded={expandedRows.has(rowKey)} onClick={() => onToggleRow(rowKey)} />
            <QualityUkeire evaluation={row} expanded={expandedRows.has(rowKey)} />
          </div>
        )
      })}
      {turn.candidates.map((row) => {
        const rowKey = `discard-${row.discard}`
        const recommended = turn.bestDiscards.includes(row.discard)
        const chosen = turn.action === 'discard' && row.discard === turn.discard
        return (
          <div className={`evaluation-row ${recommended ? 'recommended' : 'comparison'}`} key={row.discard}>
            <div className="discard-cell"><span className="rank-badge">{recommended ? '最优' : chosen ? '你的选择' : '对比'}</span><MahjongTile tile={row.discard} compact /><strong>切{tileLabel(row.discard)}</strong></div>
            <div className="evaluation-numbers"><UkeireNumbers evaluation={row} /><span>{row.shanten} 向听</span>{row.nextUkeireExpectation !== undefined && <span>次巡期望 {row.nextUkeireExpectation}</span>}<ProgressValue evaluation={row} />{row.standardShanten !== undefined && row.standardShanten !== row.shanten && <span>面子手 {row.standardShanten} 向听 · {row.standardUkeireCount}枚</span>}</div>
            <ShapeCountButton evaluation={row} expanded={expandedRows.has(rowKey)} onClick={() => onToggleRow(rowKey)} />
            <QualityUkeire evaluation={row} expanded={expandedRows.has(rowKey)} />
          </div>
        )
      })}
    </div>
  )
}

function TurnFeedback({ turn, session, expanded, onToggleExpanded }: { turn: ContinuousTurn; session: ContinuousSession; expanded: boolean; onToggleExpanded: () => void }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const solution = classifyTurnSolution(turn)
  const before = sortTiles(parseTiles(turn.beforeHand.join('')), session.suitOrder, session.dragonOrder)
  const recommended = before.find((tile) => turn.bestDiscards.includes(tile.code))
  const afterDiscard = recommended ? before.filter((tile) => tile.id !== recommended.id) : []
  const grouping = afterDiscard.length > 0 ? buildHandGroupingModel(afterDiscard) : null
  const partition = grouping?.suits.flatMap((suit) => selectedSuitPartition(suit, createHandGroupingState()).groups.map((group) => formatGroup(group, suit.suit))) ?? []
  const chosenLabel = turn.action === 'discard' ? `切${tileLabel(turn.discard)}` : `暗杠${tileLabel(turn.kanTile)}`
  const recommendation = turn.recommendedKans.length > 0
    ? `推荐暗杠：${turn.recommendedKans.map(tileLabel).join(' 或 ')}`
    : `推荐切：${turn.bestDiscards.map(tileLabel).join(' 或 ')}`
  const recommendedEvaluation = turn.recommendedKans.length > 0
    ? turn.kanCandidates.find((value) => turn.recommendedKans.includes(value.tile)) ?? turn.best
    : turn.best
  const answerRecommendations: Array<{ evaluation: DiscardEvaluation; badge: string }> = []
  if (turn.action === 'discard' && !turn.optimal) {
    const seen = new Set<TileCode>([turn.discard])
    for (const discard of turn.bestDiscards) {
      const evaluation = turn.candidates.find((candidate) => candidate.discard === discard)
      if (!evaluation || seen.has(evaluation.discard)) continue
      const isEquivalent = solution.equivalent?.discard === evaluation.discard
      answerRecommendations.push({
        evaluation,
        badge: isEquivalent ? solution.equivalentKind === 'shape' ? '好型解' : '速度解' : '推荐',
      })
      seen.add(evaluation.discard)
    }
    if (solution.equivalent && !seen.has(solution.equivalent.discard)) {
      answerRecommendations.push({
        evaluation: solution.equivalent,
        badge: solution.equivalentKind === 'shape' ? '好型解' : '速度解',
      })
    }
  }
  const comparedForHeuristic = solution.equivalent ?? (turn.optimal
    ? turn.candidates.find((value) => !turn.bestDiscards.includes(value.discard) && value.shanten === turn.best.shanten)
    : turn.action === 'discard' ? turn.chosen : undefined)
  const preferredForHeuristic = solution.kind === 'speed' || solution.kind === 'shape'
    ? turn.chosen
    : recommendedEvaluation
  const heuristic = turn.action === 'discard' && turn.recommendedKans.length === 0
    ? heuristicExplanation(turn, preferredForHeuristic as DiscardEvaluation, comparedForHeuristic)
    : undefined
  const feedbackTitle: Record<TurnSolutionKind, string> = {
    optimal: turn.action === 'kan' ? '暗杠判断正确' : '本巡最优',
    speed: '本巡速度解',
    shape: '本巡好型解',
    missed: turn.action === 'kan' ? '此处先不杠更好' : '本巡还有更好的选择',
  }
  const chosenBadge: Record<TurnSolutionKind, string> = {
    optimal: '你的选择 · 推荐',
    speed: '你的选择 · 速度解',
    shape: '你的选择 · 好型解',
    missed: '你的选择',
  }

  function toggleRow(key: string) {
    setExpandedRows((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <section className={`turn-feedback ${solution.accepted ? 'optimal' : 'missed'}`} aria-live="polite">
      <div className="turn-feedback-heading">
        <span>{solution.accepted ? '✓' : '△'}</span>
        <div className="turn-feedback-title"><strong>{feedbackTitle[solution.kind]}</strong><small>{chosenLabel}</small></div>
        {heuristic && <aside className="heuristic-note"><span>牌理提示</span>{heuristic}</aside>}
      </div>
      {turn.action === 'discard' ? <div className="answer-comparison">
        <AnswerDiscardRow evaluation={turn.chosen} badge={chosenBadge[solution.kind]} tone={solution.accepted ? 'recommended' : 'chosen'} expanded={expandedRows.has('answer-chosen')} onToggle={() => toggleRow('answer-chosen')} />
        {answerRecommendations.map(({ evaluation, badge }) => <AnswerDiscardRow
          key={`answer-${evaluation.discard}`}
          evaluation={evaluation}
          badge={badge}
          tone="recommended"
          expanded={expandedRows.has(`answer-${evaluation.discard}`)}
          onToggle={() => toggleRow(`answer-${evaluation.discard}`)}
        />)}
      </div> : <EvaluationExplanation evaluation={turn.chosen} label={`${chosenLabel}后`} />}
      {turn.action === 'discard' && turn.recommendedKans.length === 0 && !turn.bestDiscards.includes(turn.discard) && <EvaluationDifference preferred={turn.best} chosen={turn.chosen} />}
      {turn.action === 'kan' && !solution.accepted && <p>{recommendation}。当前最佳动作{ukeireSummary(recommendedEvaluation)}、好型 {recommendedEvaluation.goodShapeCount} 枚。</p>}
      {partition.length > 0 && <div className="partition"><span>本巡推荐分割</span><strong>{partition.map((group) => `[${group}]`).join(' ')}</strong></div>}
      {turn.action === 'kan' && turn.revealedDora && <p className="kan-result-message">翻开新宝牌指示物 <MahjongTile tile={turn.revealedDora} compact /> <strong>{tileLabel(turn.revealedDora)}</strong></p>}
      <button className="comparison-toggle" aria-expanded={expanded} onClick={onToggleExpanded}>{expanded ? '收起本巡切牌比较' : '查看本巡全部切牌比较'} <span>{expanded ? '⌃' : '⌄'}</span></button>
      {expanded && <div className="comparison-panel">
        <div className="previous-hand"><span>当时手牌</span><div>{before.map((tile) => <MahjongTile tile={tile} compact key={tile.id} />)}</div></div>
        <CandidateRows turn={turn} expandedRows={expandedRows} onToggleRow={toggleRow} />
      </div>}
    </section>
  )
}

export function ContinuousTrainer({ session, onBack, onNewSession }: {
  session: ContinuousSession
  onBack: () => void
  onNewSession: () => void
}) {
  const initial = useMemo(() => startContinuousSession(session), [session])
  const [state, setState] = useState<ContinuousState>(initial)
  const [displayHand, setDisplayHand] = useState(initial.hand)
  const initialGroupingModel = useMemo(() => buildHandGroupingModel(initial.hand), [initial.hand])
  const [groupingModel, setGroupingModel] = useState(initialGroupingModel)
  const [grouping, setGrouping] = useState(createHandGroupingState)
  const [mode, setMode] = useState<'discard' | 'organize'>('discard')
  const [comparisonExpanded, setComparisonExpanded] = useState(false)
  const drag = useRef({ tileId: '', startX: 0, startY: 0, moved: false })
  const handGrid = useRef<HTMLDivElement>(null)
  const lastTurn = state.history.at(-1)
  const routes = calculateRouteShanten(toCounts(state.hand), continuousShantenOptions(state).fixedMelds)
  const routeMinimum = Math.min(routes.standard, routes.chiitoi, routes.kokushi)
  const kanOptions = useMemo(() => evaluateKanOptions(state, session), [session, state])
  const optimalRate = state.history.length > 0 ? `${optimalChoicePercent(state)}%` : '—'

  const tileGroups = useMemo(() => handGroupMarks(groupingModel, grouping), [grouping, groupingModel])

  function finishDrag() {
    const moved = drag.current.moved
    drag.current.tileId = ''
    if (moved) {
      // 自由拖动表示玩家开始手动试摆；旧自动分组不再声称与新顺序对应。
      setGrouping(createHandGroupingState())
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

  function resetForHand(next: ContinuousState) {
    setState(next)
    setDisplayHand(next.hand)
    setGroupingModel(buildHandGroupingModel(next.hand))
    setGrouping(createHandGroupingState())
    setMode('discard')
    setComparisonExpanded(false)
    finishDrag()
  }

  function chooseTile(tile: TileInstance) {
    if (drag.current.moved || state.complete) return
    if (mode === 'organize') {
      setGrouping((current) => {
        const next = clickHandGrouping(current, groupingModel, tile.id)
        setDisplayHand((shown) => arrangeHandForGrouping(shown, groupingModel, next))
        return next
      })
      return
    }
    resetForHand(discardAndDraw(state, session, tile.id))
  }

  function chooseKan(tile: TileCode) {
    if (state.complete || mode !== 'discard') return
    resetForHand(declareKan(state, session, tile))
  }

  function beginDrag(tile: TileInstance, event: ReactPointerEvent<HTMLButtonElement>) {
    if (mode !== 'organize' || state.complete) return
    drag.current = { tileId: tile.id, startX: event.clientX, startY: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (mode !== 'organize' || !drag.current.tileId) return
    const bounds = handGrid.current?.getBoundingClientRect()
    if (bounds && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
      finishDrag()
      return
    }
    if (Math.hypot(event.clientX - drag.current.startX, event.clientY - drag.current.startY) < 9 && !drag.current.moved) return
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

  return (
    <main className="app-shell lesson-shell continuous-shell">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="返回课程">‹</button>
        <div className="continuous-top-title"><strong>连续牌效训练</strong><span>第 {state.history.length + 1} 巡 · 牌山剩余 {session.wall.length - state.nextWallIndex}</span></div>
        <span className="version-pill">练习</span>
      </header>
      <article className="lesson-card">
        <h1>{session.title}</h1>
        <p className="prompt">本局起手、宝牌与后续进张来自同一副即时随机牌山；每巡实时比较向听、受入与好型枚数。</p>
        <ContextBar session={session} doraIndicators={state.doraIndicators} />

        {state.declaredKans.length > 0 && <div className="declared-kan-strip"><span>已宣告暗杠</span><div>{state.declaredKans.map((tile, kanIndex) => <span className="declared-kan" key={`${tile}-${kanIndex}`}>{Array.from({ length: 4 }, (_, index) => <MahjongTile tile={tile} compact key={index} />)}</span>)}</div></div>}

        <section className="continuous-stats" aria-label="本手统计">
          <div><span>当前路线</span><strong>{routeMinimum === routes.standard ? '普通手' : routeMinimum === routes.chiitoi ? '七对子' : '国士'}</strong></div>
          <div><span>最优选择率</span><strong>{optimalRate}</strong></div>
          <div><span>最优巡数</span><strong>{state.optimalTurns}/{state.history.length}</strong></div>
        </section>
        <div className="route-meter"><span>普通 {routes.standard}</span>{Number.isFinite(routes.chiitoi) && <span>七对 {routes.chiitoi}</span>}{Number.isFinite(routes.kokushi) && <span>国士 {routes.kokushi}</span>}</div>

        <div className="hand-label"><span>{mode === 'organize' ? '整理当前手牌' : state.complete ? '本手训练结束' : '点击一张牌立即切出'}</span><small>{mode === 'organize' ? '拖动排序，点击标记分组' : state.lastDrawId ? '“摸”表示本巡进张' : ''}</small></div>
        <HandGrid ref={handGrid} tiles={displayHand} marks={mode === 'organize' ? tileGroups : undefined}>
          {(tile) => <MahjongTile
            key={tile.id}
            tile={tile}
            action={mode === 'organize' ? '整理' : '选择切牌'}
            drawn={tile.id === state.lastDrawId}
            onClick={() => chooseTile(tile)}
            onPointerDown={mode === 'organize' ? (event) => beginDrag(tile, event) : undefined}
            onPointerMove={mode === 'organize' ? moveDrag : undefined}
            onPointerEnd={mode === 'organize' ? endDrag : undefined}
            onLostPointerCapture={mode === 'organize' ? finishDrag : undefined}
          />}
        </HandGrid>

        {!state.complete && mode === 'discard' && <section className="discard-workspace">
          <div className="support-actions">
            <button className="organize-entry" onClick={() => setMode('organize')}>整理手牌与分组</button>
            <span className="turn-note">点牌即切，并自动摸下一张</span>
          </div>
          {kanOptions.length > 0 && <div className="kan-actions"><span>可选动作</span>{kanOptions.map((option) => <button onClick={() => chooseKan(option.tile)} key={option.tile}><span className="kan-action-tiles">{state.hand.filter((tile) => tile.normalized === option.tile).map((tile) => <MahjongTile tile={tile} compact key={tile.id} />)}</span><strong>暗杠{tileLabel(option.tile)}</strong><small>点击后立即判断</small></button>)}</div>}
        </section>}

        {!state.complete && mode === 'organize' && <section className="organize-workspace">
          <div className="organize-heading"><div><strong>整理手牌</strong><span>本巡分组在进张后重新匹配，首次点击才显示</span></div><button onClick={() => setDisplayHand(state.hand)}>恢复自动理牌</button></div>
          <HandGroupingGuide model={groupingModel} state={grouping} />
          <button className="primary-button full organizer-return" onClick={() => setMode('discard')}>整理完成，返回切牌</button>
        </section>}

        {lastTurn && <TurnFeedback key={lastTurn.turn} turn={lastTurn} session={session} expanded={comparisonExpanded} onToggleExpanded={() => setComparisonExpanded((current) => !current)} />}

        <section className="discard-river"><div><strong>你的牌河</strong><span>{state.discards.length} 张</span></div><div>{state.discards.map((tile, index) => <MahjongTile tile={tile} compact key={`${tile}-${index}`} />)}</div></section>

        {state.complete && <section className="continuous-complete">
          <span>听</span><h2>完成这一手</h2><p>最优选择率 {optimalChoicePercent(state)}%，其中 {state.optimalTurns}/{state.history.length} 巡选择了综合评价最优动作。</p>
          <button className="primary-button full" onClick={onNewSession}>再来一手</button>
          <button className="secondary-button full" onClick={onBack}>返回课程地图</button>
        </section>}
      </article>
    </main>
  )
}
