import { useState, useEffect } from 'react'
import { getLeaderboard, loadUserInfo } from '../api'
import type { LeaderboardEntry } from '../types'

interface Props {
  nickname: string
  onBack: () => void
}

export default function UserCenter({ nickname, onBack }: Props) {
  const [stats, setStats] = useState<LeaderboardEntry | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const userInfo = loadUserInfo()
    setIsLoggedIn(!!userInfo?.socialUid)
    getLeaderboard().then((res) => {
      if (res.ok && res.data) {
        // 用 socialUid 查找（仅登录用户有战绩记录）
        if (userInfo?.socialUid) {
          const entry = res.data[userInfo.socialUid]
          if (entry) setStats(entry)
        }
      }
    })
  }, [nickname])

  return (
    <div className="min-h-screen min-h-dvh bg-gray-50 animate-slide-up">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800 transition cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800">个人中心</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-800/20">
            <span className="text-2xl font-bold text-white">{nickname.charAt(0).toUpperCase()}</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800">{nickname}</h2>
        </div>

        {/* Stats card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">战绩统计</h3>
          {!stats ? (
            <div className="text-center text-sm text-gray-300 py-4">
              {isLoggedIn ? '暂无对战记录' : '游客模式不记录战绩，登录后可参与排行榜'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
                <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
                <div className="text-xs text-gray-400 mt-1">胜场</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                <div className="text-2xl font-bold text-red-500">{stats.losses}</div>
                <div className="text-xs text-gray-400 mt-1">负场</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-2xl font-bold text-gray-500">{stats.draws}</div>
                <div className="text-xs text-gray-400 mt-1">平局</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="text-2xl font-bold text-indigo-600">
                  {stats.wins + stats.losses + stats.draws > 0
                    ? Math.round(stats.wins / (stats.wins + stats.losses + stats.draws) * 100)
                    : 0}%
                </div>
                <div className="text-xs text-gray-400 mt-1">胜率</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
