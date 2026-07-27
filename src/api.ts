import type { ApiResponse, Room, RoomList, LoginUrlResult, UserInfo, ChatMessage, LeaderboardEntry, RequestType } from './types'

const BASE = '/api/room'

// 游客信息持久化（刷新不丢失）
const GUEST_KEY = 'gomoku_guest'

export function saveGuestInfo(nickname: string) {
  localStorage.setItem(GUEST_KEY, JSON.stringify({ nickname, isGuest: true }))
}

export function loadGuestInfo(): { nickname: string; isGuest: true } | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearGuestInfo() {
  localStorage.removeItem(GUEST_KEY)
}

// 获取当前用户信息（登录用户优先，否则尝试游客）
export function getCurrentUser(): { nickname: string; socialUid?: string; avatar?: string } | null {
  const user = loadUserInfo()
  if (user) return user
  const guest = loadGuestInfo()
  if (guest) return guest
  return null
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    return await res.json()
  } catch (e) {
    return { ok: false, error: `网络错误: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// 本地存储用户房间列表（用于重进）
const MY_ROOMS_KEY = 'gomoku_myrooms'

export function saveMyRoom(roomId: string) {
  const list: string[] = JSON.parse(localStorage.getItem(MY_ROOMS_KEY) || '[]')
  if (!list.includes(roomId)) {
    list.push(roomId)
    localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(list))
  }
}

export function getMyRooms(): string[] {
  try { return JSON.parse(localStorage.getItem(MY_ROOMS_KEY) || '[]') } catch { return [] }
}

export function removeMyRoom(roomId: string) {
  const list: string[] = JSON.parse(localStorage.getItem(MY_ROOMS_KEY) || '[]')
  localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(list.filter(id => id !== roomId)))
}

export interface CreateRoomOptions {
  forbid?: boolean       // 默认 false
  timed?: boolean        // 默认 false
  boardSize?: number     // 9 / 13 / 15，默认 15
  password?: string      // 私密房密码，留空为公开房
  socialUid?: string     // 登录用户唯一标识
}

export function createRoom(nickname: string, opts?: CreateRoomOptions) {
  return request<Room>(`${BASE}/create`, {
    method: 'POST',
    body: JSON.stringify({
      nickname,
      forbid: opts?.forbid,
      timed: opts?.timed,
      boardSize: opts?.boardSize,
      password: opts?.password,
      socialUid: opts?.socialUid,
    }),
  })
}

export function joinRoom(roomId: string, nickname: string, password?: string, socialUid?: string) {
  return request<Room>(`${BASE}/join`, {
    method: 'POST',
    body: JSON.stringify({ roomId, nickname, password, socialUid }),
  })
}

// 快速匹配：自动加入无密码的等待中房间，没有则创建新房间
export function matchRoom(nickname: string, opts?: CreateRoomOptions) {
  return request<Room>(`${BASE}/match`, {
    method: 'POST',
    body: JSON.stringify({
      nickname,
      forbid: opts?.forbid,
      timed: opts?.timed,
      boardSize: opts?.boardSize,
      socialUid: opts?.socialUid,
    }),
  })
}

// 房主解散房间（仅 waiting 阶段）
export function kickRoom(roomId: string, nickname: string) {
  return request<null>(`${BASE}/kick`, {
    method: 'POST',
    body: JSON.stringify({ roomId, nickname }),
  })
}

export function makeMove(roomId: string, nickname: string, row: number, col: number) {
  return request<Room>(`${BASE}/move`, {
    method: 'POST',
    body: JSON.stringify({ roomId, nickname, row, col }),
  })
}

export function getRoomState(roomId: string, observer = false) {
  const q = `roomId=${encodeURIComponent(roomId)}${observer ? '&observer=1' : ''}`
  return request<Room>(`${BASE}/state?${q}`)
}

export function resetRoom(roomId: string, nickname: string) {
  // 保留兼容：现在 reset 走 request 流程（双向确认）
  return requestAction(roomId, nickname, 'request', 'reset')
}

// 悔棋 / 求和 / 再来一局：发起、同意、拒绝、取消
export type RequestAction = 'request' | 'accept' | 'decline' | 'cancel'

export function requestAction(
  roomId: string,
  nickname: string,
  action: RequestAction,
  type?: RequestType,
) {
  return request<Room>(`${BASE}/request`, {
    method: 'POST',
    body: JSON.stringify({ roomId, nickname, action, type }),
  })
}

// 认输
export function resign(roomId: string, nickname: string) {
  return request<Room>(`${BASE}/action`, {
    method: 'POST',
    body: JSON.stringify({ roomId, nickname, action: 'resign' }),
  })
}

export function listRooms() {
  return request<RoomList>(`${BASE}/list`)
}

// 观战：进入指定房间（只读，不更新心跳）
export function observeRoom(roomId: string) {
  return getRoomState(roomId, true)
}

export function getLoginUrl(type: string) {
  const origin = encodeURIComponent(window.location.origin)
  return request<LoginUrlResult>(`/api/auth/login?type=${encodeURIComponent(type)}&origin=${origin}`)
}

export function exchangeCode(type: string, code: string) {
  return request<UserInfo>(`/api/auth/callback?type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`)
}

export function saveUserInfo(info: UserInfo) {
  localStorage.setItem('gomoku_user', JSON.stringify(info))
}

export function loadUserInfo(): UserInfo | null {
  try {
    const raw = localStorage.getItem('gomoku_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearUserInfo() {
  localStorage.removeItem('gomoku_user')
}

// 聊天
export function sendChat(roomId: string, nickname: string, type: 'emoji' | 'text', content: string) {
  return request<ChatMessage[]>(`${BASE}/chat`, {
    method: 'POST',
    body: JSON.stringify({ roomId, nickname, type, content }),
  })
}

export function getChat(roomId: string) {
  return request<ChatMessage[]>(`${BASE}/chat?roomId=${encodeURIComponent(roomId)}`)
}

// 重进房间
export function rejoinRoom(roomId: string, nickname: string) {
  return request<Room>(`${BASE}/rejoin`, {
    method: 'POST',
    body: JSON.stringify({ roomId, nickname }),
  })
}

// 离开房间（玩家主动退出，后端清理房间）
export function leaveRoom(roomId: string, nickname: string) {
  return request<null>(`${BASE}/leave`, {
    method: 'POST',
    body: JSON.stringify({ roomId, nickname }),
  })
}

// 排行榜
export function getLeaderboard() {
  return request<Record<string, LeaderboardEntry>>('/api/leaderboard')
}

// 重置排行榜（清空全部数据）
export function resetLeaderboard() {
  return request<Record<string, LeaderboardEntry>>('/api/leaderboard?reset=1')
}
