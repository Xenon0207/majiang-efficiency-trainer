import type { TileInstance } from '../domain/tiles'
import { groupTileIds, resolveShapeSegments, sortedVariants, type ResolvedShapeSegment, type ShapeSegmentSpec } from './rules'

export interface SegmentState {
  revealed: boolean
  cycleIndex: number
  pending: boolean
}

export interface DecompositionState {
  interacted: boolean
  segments: Record<string, SegmentState>
}

export function createDecompositionState(segments: readonly ResolvedShapeSegment[]): DecompositionState {
  return {
    interacted: false,
    segments: Object.fromEntries(segments.map((segment) => [segment.id, { revealed: false, cycleIndex: 0, pending: false }])),
  }
}

export function clickDecomposition(
  state: DecompositionState,
  segments: readonly ResolvedShapeSegment[],
  tileId: string,
): DecompositionState {
  const next: DecompositionState = {
    interacted: true,
    segments: Object.fromEntries(Object.entries(state.segments).map(([id, value]) => [id, { ...value }])),
  }

  for (const segment of segments) {
    const segmentState = next.segments[segment.id] ?? { revealed: false, cycleIndex: 0, pending: false }
    if (segment.rule.forced || segmentState.pending) {
      segmentState.revealed = true
      segmentState.pending = false
    }
    next.segments[segment.id] = segmentState
  }

  const target = segments.find((segment) => segment.tileIds.includes(tileId))
  if (target && !target.rule.forced) {
    const segmentState = next.segments[target.id]
    const count = sortedVariants(target.rule).length
    const wasReadyToCycle = state.segments[target.id]?.revealed && !state.segments[target.id]?.pending
    segmentState.cycleIndex = wasReadyToCycle ? (segmentState.cycleIndex + 1) % count : 0
    segmentState.revealed = true
  }
  return next
}

export function prepareHandChange(
  previous: DecompositionState,
  nextHand: readonly TileInstance[],
  nextSpecs: readonly ShapeSegmentSpec[],
): { state: DecompositionState; segments: ResolvedShapeSegment[] } {
  const segments = resolveShapeSegments(nextHand, nextSpecs)
  const state: DecompositionState = {
    interacted: previous.interacted,
    segments: Object.fromEntries(segments.map((segment) => {
      const old = previous.segments[segment.id]
      const variants = sortedVariants(segment.rule)
      return [segment.id, {
        revealed: false,
        cycleIndex: Math.min(old?.cycleIndex ?? 0, variants.length - 1),
        pending: true,
      }]
    })),
  }
  return { state, segments }
}

export function visibleGroups(state: DecompositionState, segment: ResolvedShapeSegment): string[] | null {
  const value = state.segments[segment.id]
  if (!value?.revealed) return null
  return sortedVariants(segment.rule)[value.cycleIndex]?.groups ?? null
}

/** 只重排各分组已经占据的位置，使 335577 能显示为 357|357，同时保留玩家对其他牌的排列。 */
export function arrangeHandByDecomposition(
  hand: readonly TileInstance[],
  segments: readonly ResolvedShapeSegment[],
  state: DecompositionState,
): TileInstance[] {
  const result = [...hand]
  for (const segment of segments) {
    const groups = visibleGroups(state, segment)
    if (!groups) continue
    const positions = result
      .map((tile, index) => segment.tileIds.includes(tile.id) ? index : -1)
      .filter((index) => index >= 0)
    const byId = new Map(result.map((tile) => [tile.id, tile]))
    const ordered = groupTileIds(segment, groups).flat().map((id) => byId.get(id)!)
    positions.forEach((position, index) => { result[position] = ordered[index] })
  }
  return result
}
