// 落子音效：用 Web Audio API 合成木质感"嗒"声，无需音频文件
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      audioCtx = new Ctor()
    }
    return audioCtx
  } catch {
    return null
  }
}

export function playStoneSound() {
  const ctx = getCtx()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime

    // 主体：木质击打音
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(340, now)
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.09)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13)
    osc.start(now)
    osc.stop(now + 0.14)
  } catch {
    // 忽略音频异常，不影响游戏
  }
}
