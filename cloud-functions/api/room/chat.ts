import { getRoomStrong, saveRoom } from "./_utils";

interface ChatBody {
  roomId: string;
  nickname: string;
  type: "emoji" | "text";
  content: string;
}

const EMOJIS = ["👍", "😄", "😤", "😂", "😅", "🙄", "👏", "💪", "🤝", "🎉", "😭", "😈"];

export async function onRequest(context: { request: Request }) {
  try {
    const roomId = context.request.method === "GET"
      ? new URL(context.request.url).searchParams.get("roomId") || ""
      : "";

    if (context.request.method === "POST") {
      const body: ChatBody = await context.request.json();
      if (!body.roomId || !body.nickname || !body.content) {
        return new Response(JSON.stringify({ ok: false, error: "参数不完整" }), { status: 400 });
      }

      const room = await getRoomStrong(body.roomId.trim().toUpperCase());
      if (!room) {
        return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
      }

      const isPlayer = room.players?.black?.nickname === body.nickname || room.players?.white?.nickname === body.nickname;
      if (!isPlayer) {
        return new Response(JSON.stringify({ ok: false, error: "你不是本局玩家" }), { status: 400 });
      }

      if (!room.messages) room.messages = [];
      room.messages.push({
        nickname: body.nickname,
        type: body.type,
        content: body.content,
        time: Date.now(),
      });

      // Keep only last 50 messages
      if (room.messages.length > 50) room.messages = room.messages.slice(-50);

      await saveRoom(room);

      return new Response(JSON.stringify({ ok: true, data: room.messages }), { status: 200 });
    }

    if (context.request.method === "GET") {
      if (!roomId) {
        return new Response(JSON.stringify({ ok: false, error: "缺少 roomId" }), { status: 400 });
      }

      const room = await getRoomStrong(roomId.trim().toUpperCase());
      if (!room) {
        return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
      }

      return new Response(JSON.stringify({ ok: true, data: room.messages || [] }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
