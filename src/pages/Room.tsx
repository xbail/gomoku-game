import { useState, useEffect, useCallback, useRef } from 'react'
import Board from '../components/Board'
import ChatPanel from '../components/ChatPanel'
import { getRoomState, makeMove, resetRoom, saveMyRoom, getChat, leaveRoom } from '../api'
import { playStoneSound } from '../sound'
import type { Room as RoomType, PlayerColor, CellState, ChatMessage } from '../types'

interface RoomProps {
  room: RoomType
  nickname: string
  onLeave: () => void
  isObserver?: boolean
}

const POLL_INTERVAL = 500

export default function Room({ room: initialRoom, nickname, onLeave, isObserver }: RoomProps) {
  const [room, setRoom] = useState<RoomType>(initialRoom)
  const [lastMove, setLastMove] = useState<[number, number] | null>(null)
  const [copied, setCopied] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(room.messages || [])
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const myColor: PlayerColor | null = isObserver
    ? null
    : room.players.black.nickname === nickname ? 'black'
    : room.players.white?.nickname === nickname ? 'white'
    : null

  // Save room for rejoin on enter (observers don't save)
  useEffect(() => { if (!isObserver) saveMyRoom(room.id) }, [room.id, isObserver])

  const doPoll = useCallback(async () => {
    const res = await getRoomState(room.id, !!isObserver)
    if (res.ok && res.data) {
      setRoom(prev => {
        const next = res.data as RoomType
        // Detect a newly placed stone and highlight + play sound
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
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [doPoll])

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
    }
  }

  const refreshChat = useCallback(async () => {
    const res = await getChat(room.id)
    if (res.ok && res.data) setChatMessages(res.data)
  }, [room.id])

  // Chat polling
  useEffect(() => {
    if (room.status === 'waiting') return
    refreshChat()
    const t = setInterval(refreshChat, 2000)
    return () => clearInterval(t)
  }, [room.status, refreshChat])

  const handleReset = async () => {
    const res = await resetRoom(room.id, nickname)
    if (res.ok && res.data) {
      setRoom(res.data)
      setLastMove(null)
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
    // 玩家身份退出：通知后端清理房间；观战者直接退出
    if (!isObserver && nickname) {
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify({ roomId: room.id, nickname })], { type: 'application/json' })
          navigator.sendBeacon('/api/room/leave', blob)
        } else {
          // 回退：fire-and-forget
          leaveRoom(room.id, nickname).catch(() => {})
        }
      } catch {
        // 忽略，不影响退出
      }
    }
    onLeave()
  }

  const isWaiting = room.status === 'waiting'
  const isGameOver = !!room.winner

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
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="text-sm font-mono tracking-wider text-indigo-600">{room.id}</span>
          </div>

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
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            观战模式 · 只读不参与
          </div>
        </div>
      )}

      {/* Player info strip */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50/80 shrink-0">
        <PlayerInfo
          nickname={room.players.black.nickname}
          color="black"
          isActive={room.currentTurn === 'black' && !isGameOver}
          isMe={myColor === 'black'}
        />
        <span className="text-xs font-bold text-gray-300 tracking-wider">VS</span>
        <PlayerInfo
          nickname={room.players.white?.nickname ?? null}
          color="white"
          isActive={room.currentTurn === 'white' && !isGameOver}
          isMe={myColor === 'white'}
          isWaiting={isWaiting}
        />
      </div>

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
          {isWaiting && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-blue-500" />
            </span>
          )}
          {isGameOver && room.winner && room.winner !== 'draw' && (
            <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
            </svg>
          )}
          {isGameOver && room.winner === 'draw' && '🤝'}
          {!isGameOver && room.currentTurn === myColor && !isWaiting && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
          )}
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
          readOnly={isObserver}
        />
      </div>

      {/* Chat panel */}
      {room.status !== 'waiting' && (
        <ChatPanel roomId={room.id} nickname={nickname} messages={chatMessages} onMessagesUpdate={refreshChat} readOnly={isObserver} />
      )}

      {/* Bottom action area */}
      <div className="shrink-0 pb-5 pt-2 flex flex-col items-center gap-2">
        {isGameOver && !isObserver && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-10 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-900/20 transition-all active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            再来一局
          </button>
        )}
        {!isGameOver && !isWaiting && !isObserver && (
          <div className="text-[11px] text-gray-400 font-medium tracking-wide">
            {room.currentTurn === myColor ? '请在棋盘上落子' : '等待对手落子...'}
          </div>
        )}
        {isWaiting && !isObserver && (
          <div className="text-[11px] text-gray-400 font-medium tracking-wide">
            将房间 ID 分享给好友
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
  if (myColor === null) return '观战中'
  if (room.currentTurn === myColor) return '你的回合'
  return '对手回合'
}

// 统计棋盘上已落子数
function countOccupied(board: CellState[][]): number {
  let n = 0
  for (const row of board) for (const c of row) if (c) n++
  return n
}

// 找出新增落子的位置
function findNewMove(prev: CellState[][], next: CellState[][]): [number, number] | null {
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      if (!prev[r]?.[c] && next[r][c]) return [r, c]
    }
  }
  return null
}

function PlayerInfo({
  nickname, color, isActive, isMe, isWaiting,
}: {
  nickname: string | null
  color: PlayerColor
  isActive: boolean
  isMe: boolean
  isWaiting?: boolean
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

      <span className={`text-xs font-medium truncate ${isActive ? 'text-gray-800' : 'text-gray-400'} ${isWaiting ? 'text-gray-300 italic' : ''}`}>
        {name}
      </span>

      {isMe && (
        <span className="text-[9px] px-1 py-px rounded bg-indigo-100 text-indigo-600 border border-indigo-200 shrink-0 font-semibold">
          ME
        </span>
      )}
    </div>
  )
}
