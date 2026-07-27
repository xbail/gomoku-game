import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Callback from './pages/Callback'
import Home from './pages/Home'
import Room from './pages/Room'
import Leaderboard from './pages/Leaderboard'
import UserCenter from './pages/UserCenter'
import { loadUserInfo, clearUserInfo, loadGuestInfo, clearGuestInfo } from './api'
import type { Room as RoomType } from './types'

type Page = 'home' | 'leaderboard' | 'user'

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string>('')
  const [roomState, setRoomState] = useState<{ room: RoomType; nickname: string } | null>(null)
  const [observeRoom, setObserveRoom] = useState<RoomType | null>(null)
  const [isCallback, setIsCallback] = useState(false)
  const [page, setPage] = useState<Page>('home')

  useEffect(() => {
    const user = loadUserInfo()
    if (user) {
      setNickname(user.nickname)
      setAvatar(user.avatar || '')
    } else {
      // 未登录则尝试恢复游客会话
      const guest = loadGuestInfo()
      if (guest) setNickname(guest.nickname)
    }
    if (window.location.pathname === '/callback' || window.location.search.includes('code=')) {
      setIsCallback(true)
    }
  }, [])

  const handleLoggedIn = (name: string) => {
    setNickname(name)
    setIsCallback(false)
    window.history.replaceState(null, '', '/')
  }

  const handleLogout = () => {
    clearUserInfo()
    clearGuestInfo()
    setNickname(null)
    setRoomState(null)
    setObserveRoom(null)
  }

  if (isCallback) {
    return <Callback onLoggedIn={handleLoggedIn} />
  }

  if (observeRoom) {
    return (
      <Room
        room={observeRoom}
        nickname=""
        isObserver
        onLeave={() => setObserveRoom(null)}
      />
    )
  }

  if (roomState) {
    return (
      <Room
        room={roomState.room}
        nickname={roomState.nickname}
        onLeave={() => setRoomState(null)}
      />
    )
  }

  if (nickname) {
    return (
      <>
        {page === 'leaderboard' && <Leaderboard onBack={() => setPage('home')} />}
        {page === 'user' && <UserCenter nickname={nickname} onBack={() => setPage('home')} />}
        {page === 'home' && (
          <Home
            nickname={nickname}
            avatar={avatar}
            onLogout={handleLogout}
            onLeaderboard={() => setPage('leaderboard')}
            onUserCenter={() => setPage('user')}
            onEnter={(room, name) => setRoomState({ room, nickname: name })}
            onObserve={(room) => setObserveRoom(room)}
          />
        )}
      </>
    )
  }

  return <Login onLoggedIn={handleLoggedIn} />
}
