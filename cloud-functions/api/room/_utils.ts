import { getStore } from "@edgeone/pages-blob";

// 命名空间 GAME_BLOB 由平台在首次 getStore 调用时自动创建，控制台无法手动新建。
const store = getStore("GAME_BLOB");

export { store };

export async function getRoom(roomId: string) {
  const data = await store.get(roomId);
  return data ? JSON.parse(data) : null;
}

export async function saveRoom(room: Record<string, unknown>) {
  room.lastActiveAt = Date.now();
  await store.set(room.id as string, JSON.stringify(room));
}

export async function getRoomStrong(roomId: string) {
  const data = await store.get(roomId, { consistency: "strong" });
  return data ? JSON.parse(data) : null;
}

// 标记房间有活动（心跳/轮询时调用，避免频繁写盘可节流）
export async function touchRoom(room: Record<string, unknown>, force = false) {
  const now = Date.now();
  const lastActive = (room.lastActiveAt as number) ?? 0;
  if (force || now - lastActive > 30_000) {
    room.lastActiveAt = now;
    await store.set(room.id as string, JSON.stringify(room));
  }
}

export async function deleteRoom(roomId: string) {
  await store.delete(roomId);
}

const LEADERBOARD_KEY = "_leaderboard";
const LEADERBOARD_VERSION = 2;

interface LeaderboardData {
  version: number;
  entries: Record<string, { nickname: string; wins: number; losses: number; draws: number }>;
}

/**
 * 读取排行榜（带版本校验）。
 * 旧格式数据（无 version 字段或版本不匹配）会被自动丢弃并重置为空。
 */
async function readLeaderboard(): Promise<LeaderboardData> {
  const raw = await store.get(LEADERBOARD_KEY, { consistency: "strong" });
  if (!raw) return { version: LEADERBOARD_VERSION, entries: {} };
  try {
    const parsed = JSON.parse(raw);
    // 版本不匹配（旧数据）→ 自动清空
    if (!parsed.version || parsed.version !== LEADERBOARD_VERSION) {
      return { version: LEADERBOARD_VERSION, entries: {} };
    }
    // 校验并过滤无效条目
    const entries: LeaderboardData["entries"] = {};
    if (parsed.entries && typeof parsed.entries === "object") {
      for (const [key, val] of Object.entries(parsed.entries)) {
        const v = val as Record<string, unknown>;
        if (key && typeof key === "string"
          && typeof v?.nickname === "string"
          && typeof v?.wins === "number"
          && typeof v?.losses === "number"
          && typeof v?.draws === "number") {
          entries[key] = { nickname: v.nickname, wins: v.wins, losses: v.losses, draws: v.draws };
        }
      }
    }
    return { version: LEADERBOARD_VERSION, entries };
  } catch {
    return { version: LEADERBOARD_VERSION, entries: {} };
  }
}

/**
 * 更新排行榜：仅记录有 socialUid 的登录用户，以 socialUid 为唯一键。
 * 游客（无 socialUid）不记入排行榜，防止刷榜。
 */
export async function updateLeaderboard(room: Record<string, unknown>, winner: string | null) {
  const data = await readLeaderboard();
  const board = data.entries;

  const players = [
    { key: (room.players as any)?.black?.socialUid, nickname: (room.players as any)?.black?.nickname },
    { key: (room.players as any)?.white?.socialUid, nickname: (room.players as any)?.white?.nickname },
  ];

  for (const p of players) {
    if (!p.key) continue;
    if (!board[p.key]) board[p.key] = { nickname: p.nickname || p.key, wins: 0, losses: 0, draws: 0 };
  }

  if (winner === "draw") {
    for (const p of players) if (p.key) board[p.key].draws += 1;
  } else if (winner) {
    const winnerKey = winner === "black" ? players[0].key : players[1].key;
    const loserKey = winner === "black" ? players[1].key : players[0].key;
    if (winnerKey) board[winnerKey].wins += 1;
    if (loserKey) board[loserKey].losses += 1;
  }

  await store.set(LEADERBOARD_KEY, JSON.stringify(data));
}

/**
 * 重置排行榜（清空全部数据）。
 */
export async function resetLeaderboard() {
  const data: LeaderboardData = { version: LEADERBOARD_VERSION, entries: {} };
  await store.set(LEADERBOARD_KEY, JSON.stringify(data));
}
