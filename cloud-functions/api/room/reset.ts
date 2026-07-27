import { getRoomStrong, saveRoom } from "./_utils";
import { createEmptyBoard } from "./_game";

interface ResetBody {
  roomId: string;
  nickname: string;
}

export async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: ResetBody = await context.request.json();
    if (!body.roomId || !body.nickname) {
      return new Response(JSON.stringify({ ok: false, error: "参数不完整" }), { status: 400 });
    }

    // 强一致读：基于最新的房间数据判定权限与状态，避免陈旧读取导致误重置
    const room = await getRoomStrong(body.roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
    }

    const isPlayer = room.players.black.nickname === body.nickname || room.players.white?.nickname === body.nickname;
    if (!isPlayer) {
      return new Response(JSON.stringify({ ok: false, error: "你不是本局玩家" }), { status: 400 });
    }

    room.board = createEmptyBoard(room.boardSize || 15);
    room.currentTurn = "black";
    room.winner = null;
    room.status = room.players.white ? "playing" : "waiting";

    await saveRoom(room);

    return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
