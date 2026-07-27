import { useState } from 'react'
import { getLoginUrl, saveGuestInfo } from '../api'
import { LOGIN_PROVIDERS } from '../types'

interface LoginProps {
  onLoggedIn: (nickname: string) => void
}

export default function Login({ onLoggedIn }: LoginProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [guestName, setGuestName] = useState('')
  const [showGuest, setShowGuest] = useState(false)
  const handleLogin = async (type: string) => {
    setLoading(type); setError('')
    const res = await getLoginUrl(type)
    if (res.ok && res.data?.url) {
      window.location.href = res.data.url
    } else {
      const errRes = res as unknown as Record<string, unknown>
      const debug = errRes.debug as Record<string, unknown> | undefined
      const detail = debug?.redirectUri ? ` (回调: ${debug.redirectUri})` : ''
      const hdr = debug?.headers ? ` 头: ${JSON.stringify(debug.headers)}` : ''
      setError((res.error || '获取登录地址失败') + detail + hdr)
      setLoading(null)
    }
  }

  const handleGuestLogin = () => {
    if (!guestName.trim()) return
    saveGuestInfo(guestName.trim())
    onLoggedIn(guestName.trim())
  }

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center p-4 animate-slide-up">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-800/30 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" />
              <circle cx="10" cy="10" r="2.5" fill="currentColor" />
              <circle cx="15" cy="14" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">五子棋</h1>
          <p className="text-sm text-gray-400 mt-0.5">选择登录方式</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="space-y-3">
            {LOGIN_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleLogin(p.id)}
                disabled={loading !== null}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 disabled:opacity-50 transition cursor-pointer text-left"
              >
                <span className="text-xl">{p.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700">{p.label} 登录</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.desc}</div>
                </div>
                {loading === p.id ? (
                  <svg className="animate-spin h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl py-2.5 px-3 border border-red-200">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100">
            {!showGuest ? (
              <button
                onClick={() => setShowGuest(true)}
                className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 rounded-xl border border-dashed border-gray-200 hover:border-gray-300 transition cursor-pointer"
              >
                游客模式直接玩
              </button>
            ) : (
              <div className="flex gap-2 animate-slide-up">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="输入昵称"
                  className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 transition text-sm"
                  maxLength={10}
                  autoFocus
                />
                <button
                  onClick={handleGuestLogin}
                  disabled={!guestName.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium shadow-md transition cursor-pointer shrink-0"
                >
                  开始
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-300 mt-6">
          Gomoku Online · EdgeOne Makers
        </p>
      </div>
    </div>
  )
}
