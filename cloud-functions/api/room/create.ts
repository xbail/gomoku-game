import { getRoom, saveRoom } from "./_utils";
import { createEmptyBoard } from "./_game";
import { DEFAULT_TIMER, NO_TIMER } from "./_timer";

interface CreateBody {
  nickname: string;
  forbid?: boolean;     // 是否启用黑方禁手规则，默认 true
  timed?: boolean;      // 是否启用计时，默认 true
}

function generateRoomId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: CreateBody = await context.request.json();
    if (!body.nickname?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "昵称不能为空" }), { status: 400 });
    }

    // 默认启用禁手与计时
    const forbid = body.forbid !== false;
    const timed = body.timed !== false;
    const timer = timed ? { ...DEFAULT_TIMER } : { ...NO_TIMER };

    let roomId: string;
    do {
      roomId = generateRoomId();
    } while (await getRoom(roomId));

    const now = Date.now();
    const room = {
      id: roomId,
      players: {
        black: { nickname: body.nickname.trim() },
        white: null,
      },
      board: createEmptyBoard(),
      currentTurn: "black",
      winner: null,
      winLine: null,
      status: "waiting",
      createdAt: now,
      moves: [] as unknown[],
      request: null,
      forbid,
      timer,
      turnStartAt: now,
      blackUsedMs: 0,
      whiteUsedMs: 0,
      timeLoser: null,
    };

    await saveRoom(room);

    return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
