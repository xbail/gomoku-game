import type { PlayerColor } from "./_game";

// 默认计时配置：每步 2 分钟，总时长不限（0 = 不限）
// 娱乐模式：给足思考时间，不因总时长判负
export const DEFAULT_TIMER = { perMoveMs: 120_000, totalMs: 0 } as const;
export const NO_TIMER = { perMoveMs: 0, totalMs: 0 } as const;

/**
 * 计算当前回合是否已超时。
 * 返回超时方颜色（若双方都有可能，优先当前轮次方）或 null。
 */
export function checkTimeout(room: {
  status: string;
  winner: unknown;
  currentTurn: PlayerColor;
  timer?: { perMoveMs: number; totalMs: number };
  turnStartAt?: number;
  blackUsedMs?: number;
  whiteUsedMs?: number;
  lastActiveAt?: number;
}): PlayerColor | null {
  if (room.status !== "playing" || room.winner) return null;
  if (!room.timer) return null;
  const now = Date.now();

  // 当前轮次方的单步时间
  const turn = room.currentTurn;
  const turnStart = room.turnStartAt ?? room.lastActiveAt ?? now;
  const elapsed = now - turnStart;

  const used = turn === "black" ? (room.blackUsedMs ?? 0) : (room.whiteUsedMs ?? 0);

  if (room.timer.perMoveMs > 0 && elapsed > room.timer.perMoveMs) return turn;
  if (room.timer.totalMs > 0 && used + elapsed > room.timer.totalMs) return turn;
  return null;
}

/**
 * 结算当前轮次已用时间，累加到该方的累计用时，并重置 turnStartAt。
 * 在切换回合时调用。
 */
export function settleUsedTime(room: {
  currentTurn: PlayerColor;
  turnStartAt?: number;
  blackUsedMs?: number;
  whiteUsedMs?: number;
}): void {
  const now = Date.now();
  const turnStart = room.turnStartAt ?? now;
  const delta = Math.max(0, now - turnStart);
  if (room.currentTurn === "black") {
    room.blackUsedMs = (room.blackUsedMs ?? 0) + delta;
  } else {
    room.whiteUsedMs = (room.whiteUsedMs ?? 0) + delta;
  }
  room.turnStartAt = now;
}

/** 读取某方剩余时间（ms） */
export function remainingMs(
  room: { currentTurn: PlayerColor; timer?: { perMoveMs: number; totalMs: number }; turnStartAt?: number; blackUsedMs?: number; whiteUsedMs?: number },
  color: PlayerColor
): { perMove: number; total: number } | null {
  if (!room.timer) return null;
  const now = Date.now();
  const used = color === "black" ? (room.blackUsedMs ?? 0) : (room.whiteUsedMs ?? 0);
  const total = room.timer.totalMs > 0 ? Math.max(0, room.timer.totalMs - used) : Infinity;
  let perMove = room.timer.perMoveMs > 0 ? room.timer.perMoveMs : Infinity;
  if (color === room.currentTurn && room.turnStartAt) {
    perMove = Math.max(0, perMove - (now - room.turnStartAt));
  }
  return { perMove, total };
}
