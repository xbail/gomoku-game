import { getRoomStrong, saveRoom, store } from "./_utils";
import { settleUsedTime } from "./_timer";

const LEADERBOARD_KEY = "_leaderboard";

// 认输：发起方直接判负
interface ActionBody {
  roomId: string;
  nickname: string;
  action: "resign";
}

export default async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: ActionBody = await context.request.json();
    if (!body.roomId || !body.nickname || !body.action) {
      return new Response(JSON.stringify({ ok: false, error: "参数不完整" }), { status: 400 });
    }

    if (body.action !== "resign") {
      return new Response(JSON.stringify({ ok: false, error: "未知操作" }), { status: 400 });
    }

    const room = await getRoomStrong(body.roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
    }

    if (room.status !== "playing" || room.winner) {
      return new Response(JSON.stringify({ ok: false, error: "对局未在进行中" }), { status: 400 });
    }

    const me: "black" | "white" | null =
      room.players.black.nickname === body.nickname ? "black"
      : room.players.white?.nickname === body.nickname ? "white"
      : null;
    if (!me) {
      return new Response(JSON.stringify({ ok: false, error: "你不是本局玩家" }), { status: 400 });
    }

    settleUsedTime(room);

    // 认输方为负，对方为胜
    room.winner = me === "black" ? "white" : "black";
    room.status = "finished";
    await saveRoom(room);

    // 更新排行榜
    const raw = await store.get(LEADERBOARD_KEY, { consistency: "strong" });
    const board: Record<string, { nickname: string; wins: number; losses: number; draws: number }> = raw ? JSON.parse(raw) : {};
    const players = [
      { key: (room.players as any)?.black?.nickname, nickname: (room.players as any)?.black?.nickname },
      { key: (room.players as any)?.white?.nickname, nickname: (room.players as any)?.white?.nickname },
    ];
    for (const p of players) {
      if (!p.key) continue;
      if (!board[p.key]) board[p.key] = { nickname: p.nickname || p.key, wins: 0, losses: 0, draws: 0 };
    }
    const winnerKey = room.winner === "black" ? players[0].key : players[1].key;
    const loserKey = room.winner === "black" ? players[1].key : players[0].key;
    if (winnerKey) board[winnerKey].wins += 1;
    if (loserKey) board[loserKey].losses += 1;
    await store.set(LEADERBOARD_KEY, JSON.stringify(board));

    return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
