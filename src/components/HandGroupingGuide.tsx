import {
  formatGroup,
  selectedSuitPartition,
  suitName,
  type HandGroupingModel,
  type HandGroupingState,
} from '../decomposition/hand-grouping'

const HONOR_LABELS = ['东', '南', '西', '北', '白', '发', '中'] as const

export function HandGroupingGuide({ model, state }: { model: HandGroupingModel; state: HandGroupingState }) {
  if (!state.interacted) {
    return <div className="grouping-empty">点击手牌后一次显示全部分组；再点同门任意牌，循环该门的合理方案。</div>
  }
  return (
    <div className="whole-hand-guide" aria-label="分组辅助">
      {model.suits.map((suit) => {
        const partition = selectedSuitPartition(suit, state)
        const structural = partition.groups.filter((group) => group.kind !== 'single')
        const singles = partition.groups.filter((group) => group.kind === 'single')
        return (
          <section className="suit-guide" key={suit.suit}>
            <div className="suit-guide-heading">
              <strong>{suitName(suit.suit)}</strong>
              <span>{structural.length === 0 ? '全是浮牌 · 不锁定' : suit.variants.length > 1 ? `方案 ${(state.cycleBySuit[suit.suit] ?? 0) + 1}/${suit.variants.length} · 点击切换` : '唯一合理分割 · 已锁定'}</span>
            </div>
            {structural.length > 0 && <div className="suit-groups">{structural.map((group) => <b key={group.id}>[{formatGroup(group, suit.suit)}]</b>)}</div>}
            {singles.length > 0 && <div className="suit-singles"><span>浮牌</span>{singles.map((group) => <b key={group.id}>{formatGroup(group, suit.suit)}</b>)}</div>}
            <small>理论受入 {partition.effectiveCount} 枚{partition.effectiveRanks.length > 0 ? ` · ${partition.effectiveRanks.map((rank) => suit.suit === 'z' ? HONOR_LABELS[rank - 1] : `${rank}${suit.suit}`).join('、')}` : ''}</small>
          </section>
        )
      })}
      <div className="grouping-legend"><span><i className="legend-locked" />所有合理方案共有，锁定</span><span><i className="legend-unlocked" />存在其他分法，可切换</span><span><i />浮牌永不锁定</span></div>
    </div>
  )
}
