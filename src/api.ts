import type { ApiResponse, Room, RoomList, LoginUrlResult, UserInfo, ChatMessage, LeaderboardEntry, RequestType } from './types'

const BASE = '/api/room'

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
  forbid?: boolean    // 默认 true
  timed?: boolean     // 默认 true
}

export function createRoom(nickname: string, opts?: CreateRoomOptions) {
  return request<Room>(`${BASE}/create`, {
    method: 'POST',
    body: JSON.stringify({ nickname, forbid: opts?.forbid, timed: opts?.timed }),
  })
}

export function joinRoom(roomId: string, nickname: string) {
  return request<Room>(`${BASE}/join`, {
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
