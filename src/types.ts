export type CellState = 'black' | 'white' | null
export type PlayerColor = 'black' | 'white'
export type GameStatus = 'waiting' | 'playing' | 'finished'

// 请求类型：悔棋 / 求和 / 再来一局（reset 改为双向确认）
export type RequestType = 'undo' | 'draw' | 'reset'

// 一次未决请求：A 向 B 发起，B 可同意/拒绝
export interface ConsentRequest {
  type: RequestType
  from: PlayerColor   // 发起方
  to: PlayerColor     // 接收方
  createdAt: number
}

// 单步落子记录（用于悔棋回退与棋谱展示）
export interface MoveRecord {
  row: number
  col: number
  color: PlayerColor
  time: number
}

export interface Player {
  nickname: string
  socialUid?: string
}

// 计时配置（毫秒）
export interface TimerConfig {
  perMoveMs: number   // 每步限时，0 表示不限
  totalMs: number     // 总时长，0 表示不限
}

export interface Room {
  id: string
  players: {
    black: Player
    white: Player | null
  }
  board: CellState[][]
  boardSize?: number                    // 棋盘大小（9/13/15），默认 15
  currentTurn: PlayerColor
  winner: PlayerColor | 'draw' | null
  winLine?: [number, number][] | null   // 获胜的 5 连位置（用于高亮）
  status: GameStatus
  createdAt: number
  messages?: ChatMessage[]
  moves?: MoveRecord[]                  // 棋谱
  request?: ConsentRequest | null       // 当前未决请求
  forbid?: boolean                      // 是否启用黑方禁手规则
  timer?: TimerConfig                   // 计时配置
  turnStartAt?: number                  // 当前回合开始时间戳
  blackUsedMs?: number                  // 黑方已用总时间
  whiteUsedMs?: number                  // 白方已用总时间
  timeLoser?: PlayerColor | null        // 因超时判负的一方
}

export interface WaitingRoomInfo {
  id: string
  blackNickname: string
  createdAt: number
  hasPassword: boolean                  // 是否为私密房
  forbid: boolean                        // 是否启用禁手
  timed: boolean                         // 是否启用计时
  boardSize: number                      // 棋盘大小
}

export interface PlayingRoomInfo {
  id: string
  blackNickname: string
  whiteNickname: string
  createdAt: number
}

export interface RoomList {
  waiting: WaitingRoomInfo[]
  playing: PlayingRoomInfo[]
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
