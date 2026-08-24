import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { TileInstance } from '../domain/tiles'
import {
  arrangeHandForGrouping,
  buildHandGroupingModel,
  clickHandGrouping,
  createHandGroupingState,
  handGroupMarks,
} from '../decomposition/hand-grouping'

export function useHandOrganizer(initialHand: readonly TileInstance[], disabled = false) {
  const [displayHand, setDisplayHand] = useState<readonly TileInstance[]>(initialHand)
  const [groupingModel, setGroupingModel] = useState(() => buildHandGroupingModel(initialHand))
  const [grouping, setGrouping] = useState(createHandGroupingState)
  const [mode, setMode] = useState<'discard' | 'organize'>('discard')
  const drag = useRef({ tileId: '', startX: 0, startY: 0, moved: false })
  const handGrid = useRef<HTMLDivElement>(null)
  const tileGroups = useMemo(() => handGroupMarks(groupingModel, grouping), [grouping, groupingModel])

  function finishDrag() {
    const moved = drag.current.moved
    drag.current.tileId = ''
    if (moved) {
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

  function resetHand(nextHand: readonly TileInstance[]) {
    drag.current = { tileId: '', startX: 0, startY: 0, moved: false }
    setDisplayHand(nextHand)
    setGroupingModel(buildHandGroupingModel(nextHand))
    setGrouping(createHandGroupingState())
    setMode('discard')
  }

  function restoreAutoSort(nextHand: readonly TileInstance[]) {
    setDisplayHand(nextHand)
    setGrouping(createHandGroupingState())
  }

  function handleOrganizeTile(tile: TileInstance): boolean {
    if (drag.current.moved) return true
    if (mode !== 'organize') return false
    setGrouping((current) => {
      const next = clickHandGrouping(current, groupingModel, tile.id)
      setDisplayHand((shown) => arrangeHandForGrouping(shown, groupingModel, next))
      return next
    })
    return true
  }

  function beginDrag(tile: TileInstance, event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || mode !== 'organize') return
    drag.current = { tileId: tile.id, startX: event.clientX, startY: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || mode !== 'organize' || !drag.current.tileId) return
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

  return {
    beginDrag,
    displayHand,
    endDrag,
    finishDrag,
    grouping,
    groupingModel,
    handleOrganizeTile,
    handGrid,
    mode,
    moveDrag,
    resetHand,
    restoreAutoSort,
    setMode,
    tileGroups,
  }
}
