import { store, deleteRoom } from "./_utils";

interface WaitingRoom {
  id: string;
  blackNickname: string;
  createdAt: number;
  hasPassword: boolean;
  forbid: boolean;
  timed: boolean;
  boardSize: number;
}

interface PlayingRoom {
  id: string;
  blackNickname: string;
  whiteNickname: string;
  createdAt: number;
}

interface RoomList {
  waiting: WaitingRoom[];
  playing: PlayingRoom[];
}

const WAITING_TTL_MS = 3 * 60 * 1000; // 等待中：3 分钟无活动清理
const PLAYING_TTL_MS = 60 * 1000; // 对战中：60 秒无活动清理（双方都不在线）
const FINISHED_TTL_MS = 30 * 1000; // 已结束：30 秒后清理

export async function onRequest() {
  try {
    const result = await store.list();
    const waiting: WaitingRoom[] = [];
    const playing: PlayingRoom[] = [];
    const now = Date.now();

    for (const blob of result.blobs) {
      // 强一致读：保证首页展示的房间状态是最新的，避免"已有人加入却仍显示等待中"
      const data = await store.get(blob.key, { consistency: "strong" });
      if (!data) continue;
      try {
        const room = JSON.parse(data);
        const lastActive = room.lastActiveAt ?? room.createdAt ?? 0;
        const idle = now - lastActive;

        // 跳过非房间键（如 _leaderboard）
        if (!room.id || !room.status) continue;

        if (room.status === "waiting") {
          if (idle > WAITING_TTL_MS) {
            await deleteRoom(room.id);
            continue;
          }
          if (room.players?.black?.nickname) {
            waiting.push({
              id: room.id,
              blackNickname: room.players.black.nickname,
              createdAt: room.createdAt ?? 0,
              hasPassword: !!room.password,
              forbid: room.forbid !== false,
              timed: !!(room.timer && (room.timer.perMoveMs > 0 || room.timer.totalMs > 0)),
              boardSize: room.boardSize ?? 15,
            });
          }
        } else if (room.status === "playing" && !room.winner) {
          if (idle > PLAYING_TTL_MS) {
            await deleteRoom(room.id);
            continue;
          }
          if (room.players?.black?.nickname && room.players?.white?.nickname) {
            playing.push({
              id: room.id,
              blackNickname: room.players.black.nickname,
              whiteNickname: room.players.white.nickname,
              createdAt: room.createdAt ?? 0,
            });
          }
        } else if (room.status === "finished" || room.winner) {
          // 已结束的对局保留短时间供双方看到结果，然后清理
          if (idle > FINISHED_TTL_MS) {
            await deleteRoom(room.id);
          }
        }
      } catch {
        // skip malformed entries
      }
    }

    // newest first
    waiting.sort((a, b) => b.createdAt - a.createdAt);
    playing.sort((a, b) => b.createdAt - a.createdAt);

    return new Response(JSON.stringify({ ok: true, data: { waiting, playing } }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
