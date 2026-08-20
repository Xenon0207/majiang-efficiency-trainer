import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import type { TileInstance } from '../domain/tiles'
import type { HandGroupMark } from '../decomposition/hand-grouping'

interface DisplayUnit {
  id: string
  status?: HandGroupMark['status']
  tiles: TileInstance[]
}

function displayUnits(tiles: readonly TileInstance[], marks: ReadonlyMap<string, HandGroupMark>): DisplayUnit[] {
  const units: DisplayUnit[] = []
  for (const tile of tiles) {
    const mark = marks.get(tile.id)
    const previous = units.at(-1)
    if (mark && previous?.id === mark.groupId) {
      previous.tiles.push(tile)
    } else {
      units.push({ id: mark?.groupId ?? `single-${tile.id}`, status: mark?.status, tiles: [tile] })
    }
  }
  return units
}

export const HandGrid = forwardRef<HTMLDivElement, {
  tiles: readonly TileInstance[]
  marks?: ReadonlyMap<string, HandGroupMark>
  children: (tile: TileInstance) => ReactNode
}>(({ tiles, marks = new Map(), children }, ref) => (
  <div className="hand-grid" ref={ref}>
    {displayUnits(tiles, marks).map((unit, unitIndex) => (
      <div
        className={unit.status ? `hand-group hand-group-${unit.status}` : 'hand-single'}
        style={{ '--group-size': unit.tiles.length } as CSSProperties}
        key={`${unit.id}-${unitIndex}`}
      >
        {unit.tiles.map(children)}
        {unit.status && <span className="hand-group-bracket" aria-hidden="true" />}
      </div>
    ))}
  </div>
))

HandGrid.displayName = 'HandGrid'
