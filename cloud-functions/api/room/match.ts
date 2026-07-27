import { store, getRoomStrong, saveRoom } from "./_utils";
import { createEmptyBoard } from "./_game";
import { DEFAULT_TIMER, NO_TIMER } from "./_timer";

interface MatchBody {
  nickname: string;
  forbid?: boolean;
  timed?: boolean;
  boardSize?: number;
}

const ALLOWED_BOARD_SIZES = [9, 13, 15];
const WAITING_TTL_MS = 3 * 60 * 1000;

/**
 * 快速匹配：优先加入一个无密码的等待中房间；
 * 若没有合适的房间则自动创建一个公开房间。
 */
export async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: MatchBody = await context.request.json();
    if (!body.nickname?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "昵称不能为空" }), { status: 400 });
    }

    const nickname = body.nickname.trim();
    const now = Date.now();

    // 1. 扫描所有 blob，找无密码、未过期、昵称不冲突的等待中房间
    const result = await store.list();
    for (const blob of result.blobs) {
      if (blob.key === "_leaderboard") continue;
      const data = await store.get(blob.key, { consistency: "strong" });
      if (!data) continue;
      try {
        const room = JSON.parse(data);
        if (!room.id || room.status !== "waiting") continue;

        // 过期清理
        const lastActive = room.lastActiveAt ?? room.createdAt ?? 0;
        if (now - lastActive > WAITING_TTL_MS) continue;

        // 跳过有密码的私密房
        if (room.password) continue;

        // 昵称冲突检查
        if (room.players?.black?.nickname === nickname) continue;

        // 尝试加入（强一致二次校验，避免并发竞争）
        const fresh = await getRoomStrong(room.id);
        if (!fresh || fresh.status !== "waiting" || fresh.players?.white) continue;
        if (fresh.players?.black?.nickname === nickname) continue;

        fresh.players.white = { nickname };
        fresh.status = "playing";
        fresh.turnStartAt = now;
        fresh.blackUsedMs = 0;
        fresh.whiteUsedMs = 0;
        await saveRoom(fresh);

        const { password: _omit, ...safeRoom } = fresh;
        return new Response(JSON.stringify({ ok: true, data: safeRoom, matched: true }), { status: 200 });
      } catch {
        // skip malformed
      }
    }

    // 2. 没有合适的房间，创建一个新的公开房间
    const forbid = body.forbid !== false;
    const timed = body.timed !== false;
    const timer = timed ? { ...DEFAULT_TIMER } : { ...NO_TIMER };
    const boardSize = ALLOWED_BOARD_SIZES.includes(body.boardSize as number) ? body.boardSize! : 15;

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let roomId = "";
    do {
      roomId = "";
      for (let i = 0; i < 6; i++) roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    } while (await getRoomStrong(roomId));

    const room = {
      id: roomId,
      players: { black: { nickname }, white: null },
      board: createEmptyBoard(boardSize),
      boardSize,
      currentTurn: "black",
      winner: null,
      winLine: null,
      status: "waiting",
      createdAt: now,
      moves: [] as unknown[],
      request: null,
      forbid,
      timer,
      password: null,
      turnStartAt: now,
      blackUsedMs: 0,
      whiteUsedMs: 0,
      timeLoser: null,
    };

    await saveRoom(room);

    const { password: _omit2, ...safeRoom2 } = room;
    return new Response(JSON.stringify({ ok: true, data: safeRoom2, matched: false }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
