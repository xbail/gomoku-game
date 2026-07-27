import { getRoomStrong, deleteRoom } from "./_utils";

interface KickBody {
  roomId: string;
  nickname: string;
}

/**
 * 房主解散房间：仅 waiting 阶段，仅黑方（房主）可操作。
 * 等待中的房间尚未开始对局，直接删除即可。
 */
export async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: KickBody = await context.request.json();
    if (!body.roomId?.trim() || !body.nickname?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "参数不完整" }), { status: 400 });
    }

    const room = await getRoomStrong(body.roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
    }

    // 仅房主（黑方）可解散
    if (room.players?.black?.nickname !== body.nickname.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "只有房主可以解散房间" }), { status: 403 });
    }

    // 仅 waiting 阶段可解散
    if (room.status !== "waiting") {
      return new Response(JSON.stringify({ ok: false, error: "对局已开始，无法解散" }), { status: 400 });
    }

    await deleteRoom(room.id);
    return new Response(JSON.stringify({ ok: true, data: null }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
