import { sortedVariants, type ResolvedShapeSegment } from '../decomposition/rules'
import { visibleGroups, type DecompositionState } from '../decomposition/state'

export function ShapeGuide({ segments, state }: { segments: readonly ResolvedShapeSegment[]; state: DecompositionState }) {
  if (segments.length === 0) return <p className="shape-empty">当前没有匹配到需要特别标记的固定局部形状，可直接拖动手牌自行整理。</p>
  return (
    <section className="shape-guide" aria-label="手牌分组辅助">
      <div className="shape-guide-heading">
        <strong>分组辅助</strong>
        <span>{state.interacted ? '点组内任意牌可切换理解方式' : '点击任意牌后，唯一分组会自动锁定'}</span>
      </div>
      <div className="shape-chips">
        {segments.map((segment) => {
          const groups = visibleGroups(state, segment)
          const current = state.segments[segment.id]
          const variants = sortedVariants(segment.rule)
          return (
            <div className={`shape-chip ${segment.rule.forced ? 'forced' : 'ambiguous'} ${groups ? 'revealed' : ''}`} key={segment.id}>
              <span className="shape-name">{segment.rule.label}</span>
              <strong>{groups ? groups.map((group) => `[${group}]`).join(' ') : `${segment.pattern}${segment.suit} · 未标记`}</strong>
              {groups && <small>{segment.rule.forced ? '已锁定' : `${(current?.cycleIndex ?? 0) + 1}/${variants.length} · 再点循环`}</small>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
