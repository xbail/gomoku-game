import { getRoomStrong, touchRoom } from "./_utils";

export async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "GET") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const url = new URL(context.request.url);
    const roomId = url.searchParams.get("roomId");
    const observer = url.searchParams.get("observer") === "1";

    if (!roomId?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "缺少 roomId" }), { status: 400 });
    }

    const room = await getRoomStrong(roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
    }

    // 心跳：仅玩家更新 lastActiveAt（节流，30 秒内不重复写盘）；观战者不养房间
    if (!observer) {
      await touchRoom(room);
    }

    return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
