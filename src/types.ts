export type CellState = 'black' | 'white' | null
export type PlayerColor = 'black' | 'white'
export type GameStatus = 'waiting' | 'playing' | 'finished'

export interface Player {
  nickname: string
}

export interface Room {
  id: string
  players: {
    black: Player
    white: Player | null
  }
  board: CellState[][]
  currentTurn: PlayerColor
  winner: PlayerColor | 'draw' | null
  status: GameStatus
  createdAt: number
  messages?: ChatMessage[]
}

export interface WaitingRoomInfo {
  id: string
  blackNickname: string
  createdAt: number
}

export interface UserInfo {
  socialUid: string
  nickname: string
  avatar: string
  type: string
}

export interface LoginUrlResult {
  url: string
  qrcode: string | null
  type: string
}

export interface ChatMessage {
  nickname: string
  type: 'emoji' | 'text'
  content: string
  time: number
}

export const CHAT_EMOJIS = ['👍','😄','😤','😂','😅','🙄','👏','💪','🤝','🎉']

export interface LeaderboardEntry {
  nickname: string
  wins: number
  losses: number
  draws: number
}

export const LOGIN_PROVIDERS = [
  { id: 'qq', label: 'QQ', icon: '💬', desc: 'QQ 账号登录' },
  { id: 'wx', label: '微信', icon: '💚', desc: '微信扫码登录' },
] as const

export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
