import { getRoomStrong, saveRoom } from "./_utils";

const HEARTBEAT_INTERVAL_MS = 60_000;

export async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "GET") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const url = new URL(context.request.url);
    const roomId = url.searchParams.get("roomId");

    if (!roomId?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "缺少 roomId" }), { status: 400 });
    }

    const room = await getRoomStrong(roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
    }

    // heartbeat: refresh createdAt for waiting rooms so the TTL resets
    if (room.status === "waiting" && Date.now() - (room.createdAt ?? 0) > HEARTBEAT_INTERVAL_MS) {
      room.createdAt = Date.now();
      await saveRoom(room);
    }

    return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
