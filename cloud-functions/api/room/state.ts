import { getRoomStrong, saveRoom, touchRoom, updateLeaderboard } from "./_utils";
import { settleUsedTime, checkTimeout } from "./_timer";

export default async function onRequest(context: { request: Request }) {
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

    // 轮询时顺便检查超时：若当前轮次方已超时，判其负
    if (!observer && room.status === "playing" && !room.winner && !room.request) {
      const timeoutLoser = checkTimeout(room);
      if (timeoutLoser) {
        settleUsedTime(room);
        room.winner = timeoutLoser === "black" ? "white" : "black";
        room.timeLoser = timeoutLoser;
        room.status = "finished";
        await saveRoom(room);
        await updateLeaderboard(room, room.winner);
      }
    }

    // 返回时不暴露密码明文
    const { password: _omit, ...safeRoom } = room;
    return new Response(JSON.stringify({ ok: true, data: safeRoom }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
