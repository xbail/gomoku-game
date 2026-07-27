import { useState, useEffect, useCallback, useRef } from 'react'
import { createRoom, joinRoom, listRooms, rejoinRoom, getMyRooms, removeMyRoom, observeRoom, matchRoom } from '../api'
import type { Room, WaitingRoomInfo, PlayingRoomInfo } from '../types'

interface HomeProps {
  nickname: string
  avatar?: string
  onLogout: () => void
  onLeaderboard: () => void
  onUserCenter: () => void
  onEnter: (room: Room, nickname: string) => void
  onObserve: (room: Room) => void
}

export default function Home({ nickname: initialNickname, avatar, onLogout, onLeaderboard, onUserCenter, onEnter, onObserve }: HomeProps) {
  const [nickname, setNickname] = useState(initialNickname)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [waitingRooms, setWaitingRooms] = useState<WaitingRoomInfo[]>([])
  const [playingRooms, setPlayingRooms] = useState<PlayingRoomInfo[]>([])
  const [myRoomsData, setMyRoomsData] = useState<Room[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // 创建房间配置
  const [showConfig, setShowConfig] = useState(false)
  const [boardSize, setBoardSize] = useState(15)
  const [forbid, setForbid] = useState(true)
  const [timed, setTimed] = useState(true)
  const [password, setPassword] = useState('')

  // 密码加入弹窗
  const [showPwdPrompt, setShowPwdPrompt] = useState(false)
  const [pendingRoomId, setPendingRoomId] = useState('')
  const [joinPwd, setJoinPwd] = useState('')

  // Refresh rooms list
  const fetchRooms = useCallback(async () => {
    const res = await listRooms()
    if (res.ok && res.data) {
      setWaitingRooms(res.data.waiting)
      setPlayingRooms(res.data.playing)
    }
  }, [])

  // Refresh my saved rooms
  const refreshMyRooms = useCallback(async () => {
    const ids = getMyRooms()
    const rooms: Room[] = []
    for (const id of ids) {
      const res = await rejoinRoom(id, initialNickname)
      if (res.ok && res.data) {
        if (!res.data.winner) {
          rooms.push(res.data)
        } else {
          removeMyRoom(id)
        }
      } else {
        removeMyRoom(id)
      }
    }
    setMyRoomsData(rooms)
  }, [initialNickname])

  useEffect(() => {
    fetchRooms()
    refreshMyRooms()
    const t = setInterval(fetchRooms, 4000)
    return () => clearInterval(t)
  }, [fetchRooms, refreshMyRooms])

  const handleCreate = async () => {
    if (!nickname.trim()) { setError('请输入昵称'); return }
    setLoading(true); setError('')
    const res = await createRoom(nickname.trim(), {
      boardSize,
      forbid,
      timed,
      password: password.trim() || undefined,
    })
    setLoading(false)
    if (res.ok && res.data) {
      onEnter(res.data, nickname.trim())
    } else {
      setError(res.error || '创建房间失败')
    }
  }

  const handleMatch = async () => {
    if (!nickname.trim()) { setError('请输入昵称'); return }
    setLoading(true); setError('')
    const res = await matchRoom(nickname.trim(), {
      boardSize,
      forbid,
      timed,
    })
    setLoading(false)
    if (res.ok && res.data) {
      onEnter(res.data, nickname.trim())
    } else {
      setError(res.error || '匹配失败')
    }
  }

  const handleJoin = async (roomId: string, hasPassword?: boolean) => {
    if (!nickname.trim()) { setError('请先输入昵称'); inputRef.current?.focus(); return }

    // 如果有密码，弹出密码输入框
    if (hasPassword) {
      setPendingRoomId(roomId)
      setJoinPwd('')
      setShowPwdPrompt(true)
      return
    }

    setLoading(true); setError('')
    const res = await joinRoom(roomId, nickname.trim())
    setLoading(false)
    if (res.ok && res.data) {
      onEnter(res.data, nickname.trim())
    } else {
      setError(res.error || '加入房间失败')
    }
  }

  const handleJoinWithPassword = async () => {
    if (!nickname.trim()) { setError('请输入昵称'); return }
    setLoading(true); setError('')
    const res = await joinRoom(pendingRoomId, nickname.trim(), joinPwd.trim())
    setLoading(false)
    if (res.ok && res.data) {
      setShowPwdPrompt(false)
      onEnter(res.data, nickname.trim())
    } else {
      setError(res.error || '密码错误')
    }
  }

  const handleRejoin = async (roomId: string) => {
    setLoading(true); setError('')
    const res = await rejoinRoom(roomId, nickname.trim())
    setLoading(false)
    if (res.ok && res.data) {
      onEnter(res.data, nickname.trim())
    } else {
      removeMyRoom(roomId)
      setError(res.error || '无法重进房间')
    }
  }

  const handleObserve = async (roomId: string) => {
    setLoading(true); setError('')
    const res = await observeRoom(roomId)
    setLoading(false)
    if (res.ok && res.data) {
      onObserve(res.data)
    } else {
      setError(res.error || '观战失败')
    }
  }

  const [roomId, setRoomId] = useState('')
  const [showManual, setShowManual] = useState(false)

  const handleJoinById = async () => {
    if (!nickname.trim()) { setError('请输入昵称'); return }
    if (!roomId.trim()) { setError('请输入房间ID'); return }
    setLoading(true); setError('')
    const res = await joinRoom(roomId.trim().toUpperCase(), nickname.trim())
    setLoading(false)
    if (res.ok && res.data) {
      onEnter(res.data, nickname.trim())
    } else {
      setError(res.error || '加入房间失败')
    }
  }

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center p-4 animate-slide-up">
      <div className="w-full max-w-md py-4">
        {/* Logo + nav */}
        <div className="text-center mb-6 relative">
          <button onClick={onLogout} className="absolute left-0 top-1 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">退出</button>
          <button onClick={onLeaderboard} className="absolute right-0 top-1 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">排行榜</button>
          <button onClick={onUserCenter} className="absolute right-0 top-6 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">个人中心</button>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-800/30 mb-3 mx-auto flex items-center justify-center overflow-hidden">
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-white">{nickname.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">五子棋</h1>
          <p className="text-sm text-gray-400 mt-0.5">你好, {nickname}</p>
        </div>

        {/* Create / Match */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="输入昵称"
              className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition text-sm"
              maxLength={10}
            />
          </div>

          {/* Config toggle */}
          <button onClick={() => setShowConfig(!showConfig)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">
            {showConfig ? '收起配置 ▲' : '创建配置 ▼'}
          </button>

          {showConfig && (
            <div className="mt-3 space-y-3 animate-slide-up">
              {/* Board size selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">棋盘大小</span>
                <div className="flex gap-1.5 flex-1">
                  {[9, 13, 15].map(size => (
                    <button
                      key={size}
                      onClick={() => setBoardSize(size)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition cursor-pointer ${
                        boardSize === size
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {size}×{size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forbid}
                    onChange={(e) => setForbid(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-600"
                  />
                  <span className="text-xs text-gray-600">禁手规则</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={timed}
                    onChange={(e) => setTimed(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-600"
                  />
                  <span className="text-xs text-gray-600">计时模式</span>
                </label>
              </div>

              {/* Password */}
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码（留空为公开房）"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition text-sm"
                maxLength={20}
              />
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl py-2 px-3 border border-red-200">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={loading || !nickname.trim()}
              className="flex-1 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium shadow-md transition cursor-pointer active:scale-[0.98]"
            >
              创建房间
            </button>
            <button
              onClick={handleMatch}
              disabled={loading || !nickname.trim()}
              className="flex-1 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium shadow-md transition cursor-pointer active:scale-[0.98]"
            >
              快速匹配
            </button>
          </div>

          <button onClick={() => setShowManual(!showManual)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">
            {showManual ? '收起' : '输入房间 ID 加入'}
          </button>

          {showManual && (
            <div className="mt-3 flex gap-2 animate-slide-up">
              <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} placeholder="输入6位房间ID" className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition tracking-widest text-center font-mono text-sm" maxLength={6} />
              <button onClick={handleJoinById} disabled={loading} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 rounded-xl text-sm transition cursor-pointer active:scale-[0.98] shrink-0">加入</button>
            </div>
          )}
        </div>

        {/* Password prompt dialog */}
        {showPwdPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-slide-up" onClick={() => setShowPwdPrompt(false)}>
            <div className="bg-white rounded-2xl p-5 mx-6 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-medium text-gray-700 mb-3">该房间需要密码</h3>
              <input
                type="text"
                value={joinPwd}
                onChange={(e) => setJoinPwd(e.target.value)}
                placeholder="输入房间密码"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition text-sm mb-3"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinWithPassword() }}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowPwdPrompt(false)} className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition cursor-pointer">取消</button>
                <button onClick={handleJoinWithPassword} disabled={loading || !joinPwd.trim()} className="flex-1 px-3 py-2 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer">确认加入</button>
              </div>
            </div>
          </div>
        )}

        {/* My Rooms */}
        {myRoomsData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-500">我的房间</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {myRoomsData.map((r) => (
                <div key={r.id} className="flex items-center gap-1 px-2 pr-4 py-2 hover:bg-gray-50 transition group">
                  <button onClick={(e) => { e.stopPropagation(); removeMyRoom(r.id); setMyRoomsData(prev => prev.filter(x => x.id !== r.id)) }} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition cursor-pointer opacity-0 group-hover:opacity-100">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button onClick={() => handleRejoin(r.id)} disabled={loading} className="flex-1 flex items-center gap-3 py-2 text-left cursor-pointer disabled:opacity-50 min-w-0">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-mono tracking-wider text-indigo-600">{r.id}</span>
                      <div className="text-xs text-gray-400 mt-0.5">{r.status === 'waiting' ? '等待对手' : r.winner ? '已结束' : '进行中'} · {r.players.black.nickname}{r.players.white ? ` vs ${r.players.white.nickname}` : ''}</div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waiting rooms */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">等待中的房间</h2>
            <button onClick={fetchRooms} className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">刷新</button>
          </div>

          {waitingRooms.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-300">暂无等待中的房间</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
              {waitingRooms.map((r) => (
                <button key={r.id} onClick={() => { setError(''); handleJoin(r.id, r.hasPassword) }} disabled={loading} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left cursor-pointer disabled:opacity-50">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    {r.hasPassword ? (
                      <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-mono tracking-wider text-indigo-600">{r.id}</span>
                      <span className="text-[10px] px-1.5 py-px rounded-full bg-green-50 text-green-600 border border-green-200 shrink-0">等待中</span>
                      {r.hasPassword && <span className="text-[10px] px-1.5 py-px rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0">私密</span>}
                      {r.boardSize !== 15 && <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-50 text-blue-600 border border-blue-200 shrink-0">{r.boardSize}×{r.boardSize}</span>}
                      {r.forbid && <span className="text-[10px] px-1.5 py-px rounded-full bg-rose-50 text-rose-600 border border-rose-200 shrink-0">禁手</span>}
                      {r.timed && <span className="text-[10px] px-1.5 py-px rounded-full bg-purple-50 text-purple-600 border border-purple-200 shrink-0">计时</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">房主: <span className="text-gray-500">{r.blackNickname}</span></div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {waitingRooms.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <span className="text-[10px] text-gray-300">共 {waitingRooms.length} 个房间 · 自动刷新</span>
            </div>
          )}
        </div>

        {/* Spectate rooms */}
        {playingRooms.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-4">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-500">对战中 · 可观战</h2>
              <button onClick={fetchRooms} className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">刷新</button>
            </div>

            <div className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
              {playingRooms.map((r) => (
                <button key={r.id} onClick={() => { setError(''); handleObserve(r.id) }} disabled={loading} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left cursor-pointer disabled:opacity-50">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono tracking-wider text-indigo-600">{r.id}</span>
                      <span className="text-[10px] px-1.5 py-px rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0">观战中</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{r.blackNickname} vs {r.whiteNickname}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <span className="text-[10px] text-gray-300">共 {playingRooms.length} 个对局 · 观战不参与游戏</span>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-gray-300 mt-6">Gomoku Online · EdgeOne Makers</p>
      </div>
    </div>
  )
}
