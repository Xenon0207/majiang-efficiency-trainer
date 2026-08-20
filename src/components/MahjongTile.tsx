import type { PointerEvent as ReactPointerEvent } from 'react'
import { tileImage, tileLabel, type TileCode, type TileInstance } from '../domain/tiles'

export function MahjongTile({ tile, selected, dimmed, onClick, onPointerDown, onPointerMove, onPointerEnd, onLostPointerCapture, compact = false, action = '', drawn = false }: {
  tile: TileInstance | TileCode
  selected?: boolean
  dimmed?: boolean
  compact?: boolean
  onClick?: () => void
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerEnd?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onLostPointerCapture?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  action?: string
  drawn?: boolean
}) {
  const code = typeof tile === 'string' ? tile : tile.code
  const id = typeof tile === 'string' ? code : tile.id
  const body = <span className="tile-art"><img className="tile-front" src="./tiles/Front.png" alt="" draggable={false} /><img className="tile-face" src={tileImage(code)} alt={tileLabel(code)} draggable={false} /></span>
  if (!onClick) return <span className={`tile ${compact ? 'compact' : ''}`} title={tileLabel(code)}>{body}</span>
  return (
    <button
      className={`tile tile-button ${selected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''} ${onPointerDown ? 'reorderable' : ''} ${drawn ? 'drawn' : ''}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onLostPointerCapture}
      data-tile-id={id}
      aria-label={`${action}${tileLabel(code)}${drawn ? '，本巡摸牌' : ''}${selected ? '，已选择' : ''}`}
    >{body}{drawn && <span className="drawn-marker">摸</span>}</button>
  )
}
