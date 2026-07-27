import { getRoom, saveRoom } from "./_utils";
import { createEmptyBoard } from "./_game";
import { DEFAULT_TIMER, NO_TIMER } from "./_timer";

interface CreateBody {
  nickname: string;
  forbid?: boolean;      // 是否启用黑方禁手规则，默认 true
  timed?: boolean;       // 是否启用计时，默认 true
  boardSize?: number;     // 棋盘大小，默认 15，可选 9/13/15
  password?: string;     // 私密房密码，留空为公开房
}

// 允许的棋盘规格
const ALLOWED_BOARD_SIZES = [9, 13, 15];

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

    // 棋盘大小：校验白名单，默认 15
    const boardSize = ALLOWED_BOARD_SIZES.includes(body.boardSize as number) ? body.boardSize! : 15;

    // 私密房密码：去空格，最长 20 字符
    const password = body.password?.trim().slice(0, 20) || null;

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
      password,
      turnStartAt: now,
      blackUsedMs: 0,
      whiteUsedMs: 0,
      timeLoser: null,
    };

    await saveRoom(room);

    // 返回时不暴露密码明文，仅返回是否加密
    const { password: _omit, ...safeRoom } = room;
    return new Response(JSON.stringify({ ok: true, data: safeRoom }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
