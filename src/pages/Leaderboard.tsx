import { useState, useEffect } from 'react'
import { getLeaderboard } from '../api'
import type { LeaderboardEntry } from '../types'

interface Props {
  onBack: () => void
}

export default function Leaderboard({ onBack }: Props) {
  const [data, setData] = useState<Record<string, LeaderboardEntry>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const res = await getLeaderboard()
    if (res.ok && res.data) setData(res.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const list = Object.entries(data)
    .map(([key, v]) => ({ key, ...v, total: v.wins + v.losses + v.draws, score: v.wins * 3 + v.draws }))
    .sort((a, b) => b.score - a.score || b.wins - a.wins || a.losses - b.losses)

  return (
    <div className="min-h-screen min-h-dvh bg-gray-50 animate-slide-up">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800 transition cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800">排行榜</h1>
        <button onClick={fetchData} className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">刷新</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-20 text-sm text-gray-300">暂无数据，快来下第一局吧</div>
      ) : (
        <div className="max-w-md mx-auto px-4 py-4 space-y-2">
          {list.map((item, i) => (
            <div key={item.key} className="bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3 shadow-sm">
              {/* Rank */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                {i + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{item.nickname}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {item.total} 局 · {item.wins} 胜 {item.losses} 负 {item.draws} 平
                  {item.total > 0 && ` · ${Math.round(item.wins / item.total * 100)}% 胜率`}
                </div>
              </div>

              {/* Score badge */}
              <div className="text-right">
                <div className="text-lg font-bold text-indigo-600">{item.score}</div>
                <div className="text-[10px] text-gray-400">积分</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
