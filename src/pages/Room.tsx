import { useState, useEffect, useCallback, useRef } from 'react'
import Board from '../components/Board'
import ChatPanel from '../components/ChatPanel'
import { getRoomState, makeMove, saveMyRoom, getChat, leaveRoom, requestAction, resign, kickRoom } from '../api'
import { playStoneSound } from '../sound'
import type { Room as RoomType, PlayerColor, CellState, ChatMessage, RequestType } from '../types'

interface RoomProps {
  room: RoomType
  nickname: string
  onLeave: () => void
  isObserver?: boolean
}

const POLL_INTERVAL = 500

function fmtMs(ms: number): string {
  if (!isFinite(ms)) return '∞'
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

// 前端计算某方剩余时间（用于流畅显示，非权威）
function remaining(room: RoomType, color: PlayerColor): { perMove: number; total: number } | null {
  if (!room.timer) return null
  const now = Date.now()
  const used = color === 'black' ? (room.blackUsedMs ?? 0) : (room.whiteUsedMs ?? 0)
  const total = room.timer.totalMs > 0 ? Math.max(0, room.timer.totalMs - used) : Infinity
  let perMove = room.timer.perMoveMs > 0 ? room.timer.perMoveMs : Infinity
  if (color === room.currentTurn && room.turnStartAt && !room.winner) {
    perMove = Math.max(0, perMove - (now - room.turnStartAt))
  }
  return { perMove, total }
}

export default function Room({ room: initialRoom, nickname, onLeave, isObserver }: RoomProps) {
  const [room, setRoom] = useState<RoomType>(initialRoom)
  const [lastMove, setLastMove] = useState<[number, number] | null>(null)
  const [copied, setCopied] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(room.messages || [])
  const [notice, setNotice] = useState<string | null>(null)
  const [, setTick] = useState(0)  // 触发计时重渲染
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const myColor: PlayerColor | null = isObserver
    ? null
    : room.players.black.nickname === nickname ? 'black'
    : room.players.white?.nickname === nickname ? 'white'
    : null

  useEffect(() => { if (!isObserver) saveMyRoom(room.id) }, [room.id, isObserver])

  const doPoll = useCallback(async () => {
    const res = await getRoomState(room.id, !!isObserver)
    if (res.ok && res.data) {
      setRoom(prev => {
        const next = res.data as RoomType
        if (countOccupied(next.board) > countOccupied(prev.board)) {
          const move = findNewMove(prev.board, next.board)
          if (move) {
            setLastMove(move)
            playStoneSound()
          }
        }
        return next
      })
    }
  }, [room.id])

  useEffect(() => {
    pollingRef.current = setInterval(doPoll, POLL_INTERVAL)
    // 计时秒级刷新
    if (room.timer && (room.timer.perMoveMs > 0 || room.timer.totalMs > 0)) {
      tickRef.current = setInterval(() => setTick(t => t + 1), 1000)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [doPoll, room.timer])

  const scheduleForcePoll = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleCellClick = async (row: number, col: number) => {
    if (isObserver) return
    if (room.board[row][col]) return
    const res = await makeMove(room.id, nickname, row, col)
    if (res.ok && res.data) {
      setRoom(res.data)
      setLastMove([row, col])
      playStoneSound()
      if (scheduleForcePoll.current) clearTimeout(scheduleForcePoll.current)
      scheduleForcePoll.current = setTimeout(() => doPoll(), 100)
    } else {
      setNotice(res.error || '落子失败')
      setTimeout(() => setNotice(null), 2500)
    }
  }

  const refreshChat = useCallback(async () => {
    const res = await getChat(room.id)
    if (res.ok && res.data) setChatMessages(res.data)
  }, [room.id])

  useEffect(() => {
    if (room.status === 'waiting') return
    refreshChat()
    const t = setInterval(refreshChat, 2000)
    return () => clearInterval(t)
  }, [room.status, refreshChat])

  // ===== 请求类操作（悔棋/求和/再来一局）=====
  const sendRequest = async (type: RequestType) => {
    const res = await requestAction(room.id, nickname, 'request', type)
    if (res.ok && res.data) {
      setRoom(res.data)
    } else {
      setNotice(res.error || '操作失败')
      setTimeout(() => setNotice(null), 2500)
    }
  }

  const respondRequest = async (accept: boolean) => {
    if (!room.request) return
    const res = await requestAction(room.id, nickname, accept ? 'accept' : 'decline')
    if (res.ok && res.data) {
      setRoom(res.data)
      if (accept && room.request?.type === 'reset') setLastMove(null)
    } else {
      setNotice(res.error || '操作失败')
      setTimeout(() => setNotice(null), 2500)
    }
  }

  const cancelRequest = async () => {
    if (!room.request) return
    const res = await requestAction(room.id, nickname, 'cancel')
    if (res.ok && res.data) setRoom(res.data)
  }

  const handleResign = async () => {
    if (!confirm('确认认输？')) return
    const res = await resign(room.id, nickname)
    if (res.ok && res.data) setRoom(res.data)
    else {
      setNotice(res.error || '认输失败')
      setTimeout(() => setNotice(null), 2500)
    }
  }

  const handleDisband = async () => {
    if (!confirm('确认解散房间？')) return
    const res = await kickRoom(room.id, nickname)
    if (res.ok) {
      onLeave()
    } else {
      setNotice(res.error || '解散失败')
      setTimeout(() => setNotice(null), 2500)
    }
  }

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(room.id)
    } catch {
      const el = document.createElement('textarea')
      el.value = room.id
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeave = () => {
    if (!isObserver && nickname) {
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify({ roomId: room.id, nickname })], { type: 'application/json' })
          navigator.sendBeacon('/api/room/leave', blob)
        } else {
          leaveRoom(room.id, nickname).catch(() => {})
        }
      } catch {}
    }
    onLeave()
  }

  const isWaiting = room.status === 'waiting'
  const isGameOver = !!room.winner
  const hasRequest = !!room.request
  const isMyRequest = room.request?.from === myColor
  const requestToMe = room.request?.to === myColor

  const reqLabel: Record<RequestType, string> = {
    undo: '悔棋',
    draw: '求和',
    reset: '再来一局',
  }

  const myTime = myColor ? remaining(room, myColor) : null

  return (
    <div className="min-h-screen min-h-dvh flex flex-col animate-slide-up">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        <button onClick={handleLeave} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition cursor-pointer px-2 py-1 -ml-2 rounded-lg hover:bg-gray-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          退出
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-indigo-50 rounded-full px-3 py-1">
            <span className="text-sm font-mono tracking-wider text-indigo-600">{room.id}</span>
          </div>
          {room.forbid && (
            <span className="text-[10px] px-1.5 py-px rounded-full bg-rose-50 text-rose-600 border border-rose-200 shrink-0">禁手</span>
          )}
          {room.boardSize && room.boardSize !== 15 && (
            <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-50 text-blue-600 border border-blue-200 shrink-0">{room.boardSize}×{room.boardSize}</span>
          )}
          <button
            onClick={handleCopyRoomId}
            className={`text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-500 hover:text-gray-800 hover:border-gray-400 transition cursor-pointer ${isObserver ? 'hidden' : ''}`}
          >
            {copied ? '✓ 已复制' : '邀请好友'}
          </button>
        </div>
      </div>

      {/* Observer banner */}
      {isObserver && (
        <div className="flex justify-center shrink-0 py-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
            观战模式 · 只读不参与
          </div>
        </div>
      )}

      {/* Notice toast */}
      {notice && (
        <div className="flex justify-center shrink-0 py-1 px-4">
          <div className="px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-[11px] font-medium">
            {notice}
          </div>
        </div>
      )}

      {/* Player info strip with timer */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50/80 shrink-0">
        <PlayerInfo
          nickname={room.players.black.nickname}
          color="black"
          isActive={room.currentTurn === 'black' && !isGameOver}
          isMe={myColor === 'black'}
          isWaiting={isWaiting}
          time={remaining(room, 'black')}
        />
        <span className="text-xs font-bold text-gray-300 tracking-wider">VS</span>
        <PlayerInfo
          nickname={room.players.white?.nickname ?? null}
          color="white"
          isActive={room.currentTurn === 'white' && !isGameOver}
          isMe={myColor === 'white'}
          isWaiting={isWaiting}
          time={remaining(room, 'white')}
        />
      </div>

      {/* Request banner */}
      {hasRequest && !isObserver && (
        <div className="flex justify-center shrink-0 py-2 px-4">
          {isMyRequest ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
              已发起「{reqLabel[room.request!.type]}」请求，等待对手回应
              <button onClick={cancelRequest} className="px-2 py-0.5 rounded-full bg-white text-gray-500 border border-gray-200 text-[11px] cursor-pointer hover:bg-gray-50">取消</button>
            </div>
          ) : requestToMe ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
              对手请求「{reqLabel[room.request!.type]}」
              <button onClick={() => respondRequest(true)} className="px-2.5 py-0.5 rounded-full bg-green-600 text-white text-[11px] cursor-pointer hover:bg-green-500">同意</button>
              <button onClick={() => respondRequest(false)} className="px-2.5 py-0.5 rounded-full bg-white text-gray-600 border border-gray-200 text-[11px] cursor-pointer hover:bg-gray-50">拒绝</button>
            </div>
          ) : null}
        </div>
      )}

      {/* Status pill */}
      <div className="flex justify-center shrink-0 pt-2.5 pb-1">
        <div className={`
          inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-semibold tracking-wide border
          ${isGameOver && room.winner === 'draw' ? 'bg-gray-100 text-gray-500 border-gray-200' : ''}
          ${isGameOver && room.winner && room.winner !== 'draw'
            ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm'
            : ''}
          ${isWaiting ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}
          ${!isGameOver && !isWaiting && room.currentTurn === myColor
            ? 'bg-green-50 text-green-700 border-green-200'
            : ''}
          ${!isGameOver && !isWaiting && room.currentTurn !== myColor
            ? 'bg-gray-100 text-gray-500 border-gray-200'
            : ''}
        `}>
          {statusText(room, myColor)}
        </div>
      </div>

      {/* Board area */}
      <div className="flex-1 flex items-center justify-center px-2 py-2 min-h-0">
        <Board
          board={room.board}
          currentTurn={room.currentTurn}
          myColor={myColor}
          winner={room.winner}
          onCellClick={handleCellClick}
          lastMove={lastMove}
          winLine={room.winLine}
          readOnly={isObserver}
        />
      </div>

      {/* Chat panel */}
      {room.status !== 'waiting' && (
        <ChatPanel roomId={room.id} nickname={nickname} messages={chatMessages} onMessagesUpdate={refreshChat} readOnly={isObserver} />
      )}

      {/* Bottom action area */}
      <div className="shrink-0 pb-5 pt-2 flex flex-col items-center gap-2">
        {/* 游戏进行中的动作：悔棋 / 求和 / 认输 */}
        {!isGameOver && !isWaiting && !isObserver && !hasRequest && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => sendRequest('undo')}
              disabled={(room.moves?.length ?? 0) === 0}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              悔棋
            </button>
            <button
              onClick={() => sendRequest('draw')}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            >
              求和
            </button>
            <button
              onClick={handleResign}
              className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition cursor-pointer"
            >
              认输
            </button>
          </div>
        )}
        {/* 已结束：再来一局（双向确认） */}
        {isGameOver && !isObserver && !hasRequest && (
          <button
            onClick={() => sendRequest('reset')}
            className="flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-900/20 transition-all active:scale-95 cursor-pointer"
          >
            再来一局
          </button>
        )}
        {!isGameOver && !isWaiting && !isObserver && (
          <div className="text-[11px] text-gray-400 font-medium tracking-wide">
            {room.currentTurn === myColor ? '请在棋盘上落子' : '等待对手落子...'}
            {myTime && myTime.perMove !== Infinity && (
              <span className="ml-2 text-gray-300">· 剩余 {fmtMs(myTime.perMove)}</span>
            )}
          </div>
        )}
        {isWaiting && !isObserver && (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleDisband}
              className="px-4 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition cursor-pointer"
            >
              解散房间
            </button>
            <div className="text-[11px] text-gray-400 font-medium tracking-wide">
              将房间 ID 分享给好友
            </div>
          </div>
        )}
        {isObserver && (
          <div className="text-[11px] text-gray-400 font-medium tracking-wide">
            观战中
          </div>
        )}
      </div>
    </div>
  )
}

function statusText(room: RoomType, myColor: PlayerColor | null): string {
  if (room.status === 'waiting') return '等待对手加入'
  if (room.winner === 'draw') return '平局'
  if (room.winner === 'black') return `${room.players.black.nickname} 获胜!`
  if (room.winner === 'white') return `${room.players.white?.nickname} 获胜!`
  if (room.timeLoser) return '超时判负'
  if (myColor === null) return '观战中'
  if (room.currentTurn === myColor) return '你的回合'
  return '对手回合'
}

function countOccupied(board: CellState[][]): number {
  let n = 0
  for (const row of board) for (const c of row) if (c) n++
  return n
}

function findNewMove(prev: CellState[][], next: CellState[][]): [number, number] | null {
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      if (!prev[r]?.[c] && next[r][c]) return [r, c]
    }
  }
  return null
}

function PlayerInfo({
  nickname, color, isActive, isMe, isWaiting, time,
}: {
  nickname: string | null
  color: PlayerColor
  isActive: boolean
  isMe: boolean
  isWaiting?: boolean
  time: { perMove: number; total: number } | null
}) {
  const name = nickname || '等待中...'
  return (
    <div className={`
      flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 min-w-0
      ${isActive ? 'bg-white shadow-sm ring-1 ring-gray-200' : ''}
      ${isMe && !isActive ? 'bg-indigo-50/50' : ''}
    `}>
      <div className="relative shrink-0">
        <div className={`
          w-4 h-4 rounded-full
          ${color === 'black' ? 'stone-black' : 'stone-white'}
          ${isActive ? 'ring-2 ring-offset-1 ring-green-400/60 ring-offset-white' : ''}
        `} />
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span className={`text-xs font-medium truncate ${isActive ? 'text-gray-800' : 'text-gray-400'} ${isWaiting ? 'text-gray-300 italic' : ''} block`}>
          {name}
          {isMe && (
            <span className="ml-1 text-[9px] px-1 py-px rounded bg-indigo-100 text-indigo-600 border border-indigo-200 shrink-0 font-semibold align-middle">
              ME
            </span>
          )}
        </span>
        {time && time.perMove !== Infinity && (
          <span className={`text-[10px] ${isActive ? 'text-red-500' : 'text-gray-300'} font-mono`}>
            {fmtMs(time.perMove)}
            {time.total !== Infinity && <span className="text-gray-300"> / {fmtMs(time.total)}</span>}
          </span>
        )}
      </div>
    </div>
  )
}
