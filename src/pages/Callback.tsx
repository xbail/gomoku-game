import { useEffect, useState } from 'react'
import { exchangeCode, saveUserInfo } from '../api'

interface CallbackProps {
  onLoggedIn: (nickname: string) => void
}

export default function Callback({ onLoggedIn }: CallbackProps) {
  const [status, setStatus] = useState('处理中...')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type')
    const code = params.get('code')

    if (!type || !code) {
      setStatus('参数错误，请重新登录')
      setTimeout(() => window.location.href = '/', 2000)
      return
    }

    exchangeCode(type, code).then((res) => {
      if (res.ok && res.data) {
        saveUserInfo(res.data)
        onLoggedIn(res.data.nickname)
        window.location.href = '/'
      } else {
        setStatus(res.error || '登录失败')
        setTimeout(() => window.location.href = '/', 2000)
      }
    })
  }, [onLoggedIn])

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center p-4">
      <div className="text-center">
        <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-indigo-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-gray-500">{status}</p>
      </div>
    </div>
  )
}
