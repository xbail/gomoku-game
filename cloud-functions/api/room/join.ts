import { getRoomStrong, saveRoom } from "./_utils";

interface JoinBody {
  roomId: string;
  nickname: string;
  password?: string;
  socialUid?: string;
}

export default async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: JoinBody = await context.request.json();
    if (!body.roomId?.trim() || !body.nickname?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "参数不完整" }), { status: 400 });
    }

    // 强一致读：避免读到陈旧的 waiting 状态，否则对战中房间会被误判为可加入，
    // 后加入者会覆盖掉已有的白方玩家（即"把对战中某人挤掉"的 Bug）
    const room = await getRoomStrong(body.roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
    }

    // 双重校验：房间必须仍处于等待中，且白方尚未被人占用
    if (room.status !== "waiting" || room.players?.white) {
      return new Response(JSON.stringify({ ok: false, error: "房间已满" }), { status: 400 });
    }

    // 私密房密码校验
    if (room.password) {
      const inputPwd = body.password?.trim() ?? "";
      if (inputPwd !== room.password) {
        return new Response(JSON.stringify({ ok: false, error: "密码错误" }), { status: 403 });
      }
    }

    const nickname = body.nickname.trim();
    if (room.players.black.nickname === nickname) {
      return new Response(JSON.stringify({ ok: false, error: "昵称重复" }), { status: 400 });
    }

    // 防刷榜：同一登录用户不能同时占黑白双方
    const blackUid = (room.players as any)?.black?.socialUid;
    const myUid = body.socialUid?.trim();
    if (blackUid && myUid && blackUid === myUid) {
      return new Response(JSON.stringify({ ok: false, error: "不能和自己对战哦" }), { status: 400 });
    }

    room.players.white = { nickname, ...(myUid ? { socialUid: myUid } : {}) };
    room.status = "playing";
    // 对局开始：初始化回合计时
    room.turnStartAt = Date.now();
    room.blackUsedMs = 0;
    room.whiteUsedMs = 0;

    await saveRoom(room);

    // 返回时不暴露密码
    const { password: _omit, ...safeRoom } = room;
    return new Response(JSON.stringify({ ok: true, data: safeRoom }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
