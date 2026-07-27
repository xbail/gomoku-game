import { getRoomStrong, deleteRoom } from "./_utils";

interface LeaveBody {
  roomId: string;
  nickname: string;
}

// 玩家主动离开：标记 lastActiveAt，若对局未结束则直接清理房间
export async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: LeaveBody = await context.request.json();
    if (!body.roomId || !body.nickname) {
      return new Response(JSON.stringify({ ok: false, error: "参数不完整" }), { status: 400 });
    }

    const room = await getRoomStrong(body.roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: true, data: null }), { status: 200 });
    }

    const isPlayer =
      room.players?.black?.nickname === body.nickname ||
      room.players?.white?.nickname === body.nickname;

    if (!isPlayer) {
      // 观战者离开，无需处理
      return new Response(JSON.stringify({ ok: true, data: null }), { status: 200 });
    }

    // 玩家离开：等待中的房间直接删；对战中或已结束也删（避免挂在观战列表）
    await deleteRoom(room.id);

    return new Response(JSON.stringify({ ok: true, data: null }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
