import { useMemo, useRef, useState, useCallback } from 'react'
import type { CellState, PlayerColor } from '../types'

interface BoardProps {
  board: CellState[][]
  currentTurn: PlayerColor
  myColor: PlayerColor | null
  winner: PlayerColor | 'draw' | null
  onCellClick: (row: number, col: number) => void
  lastMove: [number, number] | null
  readOnly?: boolean
}

const N = 15
const GAPS = N - 1
const FRAME_PX = 4

export default function Board({ board, currentTurn, myColor, winner, onCellClick, lastMove, readOnly }: BoardProps) {
  const isMyTurn = myColor === currentTurn && !winner
  const interactive = !readOnly
  const [toast, setToast] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1000)
  }, [])

  const handleClick = useCallback((ri: number, ci: number) => {
    if (!interactive) return
    const cell = board[ri][ci]
    if (winner) { showToast('游戏已结束'); return }
    if (!myColor) { showToast('你不是本局玩家'); return }
    if (myColor !== currentTurn) { showToast('等待对手落子'); return }
    if (cell) { showToast('已有棋子'); return }

    // Toggle selection
    if (selectedCell?.[0] === ri && selectedCell?.[1] === ci) {
      setSelectedCell(null)
    } else {
      setSelectedCell([ri, ci])
    }
  }, [board, currentTurn, myColor, winner, showToast, selectedCell, interactive])

  const handleConfirm = () => {
    if (!selectedCell) return
    const [ri, ci] = selectedCell
    setSelectedCell(null)
    onCellClick(ri, ci)
  }

  const handleCancel = () => {
    setSelectedCell(null)
  }

  const starPoints = useMemo(() => {
    const pts: [number, number][] = []
    for (const r of [3, 7, 11]) {
      for (const c of [3, 7, 11]) pts.push([r, c])
    }
    return pts
  }, [])

  const boardPx = 'min(94vw, 72vh, 720px)'
  const intersectionPct = (i: number) => `${(i / GAPS) * 100}%`
  const hitPct = `${100 / GAPS}%`

  return (
    <div className="relative animate-slide-up select-none">
      {/* Toast feedback */}
      {toast && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-slide-up">
          <div className="px-3 py-1 rounded-full bg-gray-900/85 text-white text-[11px] font-medium shadow-lg whitespace-nowrap backdrop-blur-sm">
            {toast}
          </div>
        </div>
      )}

      <div
        className="relative rounded-xl"
        style={{
          width: boardPx,
          height: boardPx,
          background: 'linear-gradient(145deg, #8b6914 0%, #a07828 30%, #7a5c18 70%, #6b4e12 100%)',
          padding: FRAME_PX,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        }}
      >
        <div className="relative w-full h-full rounded-lg overflow-hidden" style={{
          background: 'linear-gradient(135deg, #e8c87a 0%, #deb565 15%, #d4a855 30%, #deb565 50%, #e8c87a 70%, #deb565 85%, #d4a855 100%)',
        }}>
          {/* Wood grain */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(139,90,43,0.3) 2px, rgba(139,90,43,0.3) 3px)`,
          }} />

          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {Array.from({ length: N }).map((_, i) => (
              <g key={i}>
                <line x1={intersectionPct(i)} y1="0%" x2={intersectionPct(i)} y2="100%" stroke="rgba(101,67,33,0.55)" strokeWidth="0.8" />
                <line x1="0%" y1={intersectionPct(i)} x2="100%" y2={intersectionPct(i)} stroke="rgba(101,67,33,0.55)" strokeWidth="0.8" />
              </g>
            ))}
            {starPoints.map(([r, c]) => (
              <circle key={`s-${r}-${c}`} cx={intersectionPct(c)} cy={intersectionPct(r)} r="4" fill="rgba(101,67,33,0.75)" />
            ))}
          </svg>

          {board.map((row, ri) =>
            row.map((cell, ci) => {
              const isLast = lastMove?.[0] === ri && lastMove?.[1] === ci
              const isSelected = selectedCell?.[0] === ri && selectedCell?.[1] === ci
              const canPlace = !cell && !winner && isMyTurn && interactive

              return (
                <div
                  key={`${ri}-${ci}`}
                  onClick={() => handleClick(ri, ci)}
                  className={`intersection-cell absolute z-10 ${!interactive ? 'cursor-default' : ''}`}
                  style={{
                    left: intersectionPct(ci),
                    top: intersectionPct(ri),
                    width: hitPct,
                    height: hitPct,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center"
                    style={{ margin: `-${100 / GAPS / 3}%` }}
                  >
                    {/* Ghost preview */}
                    {canPlace && !isSelected && (
                      <div className={`intersection-hint rounded-full ${myColor === 'black' ? 'bg-gray-900' : 'bg-white'}`}
                        style={{ width: '82%', paddingBottom: '82%' }} />
                    )}

                    {/* Selected marker */}
                    {isSelected && (
                      <div className="rounded-full bg-green-400/40 border-[3px] border-green-500 shadow-lg shadow-green-500/30"
                        style={{ width: '82%', paddingBottom: '82%' }} />
                    )}

                    {/* Last-move highlight ring (outside stone) */}
                    {isLast && (
                      <div className="absolute rounded-full ring-2 ring-red-500 animate-last-pulse pointer-events-none"
                        style={{ width: '92%', height: '92%' }} />
                    )}

                    {/* Stone */}
                    {cell && (
                      <div className={`absolute rounded-full ${cell === 'black' ? 'stone-black' : 'stone-white'}`}
                        style={{ width: '82%', height: '82%' }}
                      >
                        {isLast && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className={`w-[26%] h-[26%] rounded-full ${cell === 'black' ? 'bg-red-400' : 'bg-red-500'} shadow-md`} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Coordinate labels */}
      <div className="flex justify-between text-[10px] text-amber-700/40 select-none mt-1 px-0.5">
        {Array.from({ length: N }).map((_, i) => (
          <span key={i} className="text-center" style={{ width: hitPct }}>
            {String.fromCharCode(65 + i)}
          </span>
        ))}
      </div>

      {/* Confirm / Cancel buttons */}
      {selectedCell && (
        <div className="flex items-center justify-center gap-3 mt-2 animate-slide-up">
          <button onClick={handleCancel} className="px-4 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 transition cursor-pointer">
            取消
          </button>
          <button onClick={handleConfirm} className="px-5 py-1.5 text-xs rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold shadow-md transition active:scale-95 cursor-pointer">
            确认落子
          </button>
        </div>
      )}

      {/* Turn indicator */}
      {isMyTurn && !winner && !selectedCell && interactive && (
        <div className="flex justify-center mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-green-600 text-[11px] text-white font-medium shadow-lg border border-green-500/40 pointer-events-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-green-300 opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-green-400" />
            </span>
            请选择落子位置
          </div>
        </div>
      )}
    </div>
  )
}
