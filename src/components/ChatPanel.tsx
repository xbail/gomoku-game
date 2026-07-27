import { useEffect, useRef, useState } from 'react'
import { sendChat } from '../api'
import { CHAT_EMOJIS } from '../types'

interface ChatPanelProps {
  roomId: string
  nickname: string
  messages: { nickname: string; type: string; content: string; time: number }[]
  onMessagesUpdate: () => void
}

const QUICK_TEXTS = ['下这里', '好棋', '失误了', '哈哈', '加油', '再来']

export default function ChatPanel({ roomId, nickname, messages, onMessagesUpdate }: ChatPanelProps) {
  const [toastList, setToastList] = useState<{ id: number; msg: string }[]>([])
  const idRef = useRef(0)
  const prevLen = useRef(messages.length)

  // Show incoming messages as toast
  useEffect(() => {
    if (messages.length > prevLen.current) {
      const newMsgs = messages.slice(prevLen.current)
      for (const m of newMsgs) {
        const text = m.type === 'emoji' ? m.content : `${m.nickname}: ${m.content}`
        const id = ++idRef.current
        setToastList(prev => [...prev, { id, msg: text }])
        setTimeout(() => {
          setToastList(prev => prev.filter(t => t.id !== id))
        }, 2500)
      }
    }
    prevLen.current = messages.length
  }, [messages])

  const doSend = async (type: 'emoji' | 'text', content: string) => {
    await sendChat(roomId, nickname, type, content)
    onMessagesUpdate()
  }

  return (
    <div className="shrink-0 px-3 pb-1">
      {/* Toast notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none">
        {toastList.map(t => (
          <div key={t.id} className="animate-slide-up px-4 py-2 rounded-xl bg-gray-900/85 text-white text-sm shadow-xl backdrop-blur-sm whitespace-nowrap">
            {t.msg}
          </div>
        ))}
      </div>

      {/* Quick buttons */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {CHAT_EMOJIS.map(e => (
          <button key={e} onClick={() => doSend('emoji', e)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-sm transition cursor-pointer">{e}</button>
        ))}
        <span className="w-px h-4 bg-gray-200 mx-0.5" />
        {QUICK_TEXTS.map(t => (
          <button key={t} onClick={() => doSend('text', t)} className="px-2 py-0.5 text-[11px] rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition cursor-pointer">{t}</button>
        ))}
      </div>
    </div>
  )
}
