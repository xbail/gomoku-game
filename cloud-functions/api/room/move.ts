import { getRoomStrong, saveRoom, updateLeaderboard } from "./_utils";
import { findWinLine, isBoardFull, checkForbidden } from "./_game";
import { settleUsedTime, checkTimeout } from "./_timer";

interface MoveBody {
  roomId: string;
  nickname: string;
  row: number;
  col: number;
}

export default async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: MoveBody = await context.request.json();
    if (!body.roomId || !body.nickname || body.row === undefined || body.col === undefined) {
      return new Response(JSON.stringify({ ok: false, error: "参数不完整" }), { status: 400 });
    }

    const room = await getRoomStrong(body.roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
    }

    if (room.status !== "playing") {
      return new Response(JSON.stringify({ ok: false, error: "游戏未开始" }), { status: 400 });
    }

    if (room.winner) {
      return new Response(JSON.stringify({ ok: false, error: "游戏已结束" }), { status: 400 });
    }

    // 落子前先检查是否有未决请求 —— 存在未决请求时不允许落子
    if (room.request) {
      return new Response(JSON.stringify({ ok: false, error: "有待处理的请求，请先处理" }), { status: 400 });
    }

    const playerColor: "black" | "white" | null =
      room.players.black.nickname === body.nickname ? "black"
      : room.players.white?.nickname === body.nickname ? "white"
      : null;
    if (!playerColor) {
      return new Response(JSON.stringify({ ok: false, error: "你不是本局玩家" }), { status: 400 });
    }

    // 落子前检查超时（可能对手已超时，此时应判对方负）
    const timeoutLoser = checkTimeout(room);
    if (timeoutLoser) {
      settleUsedTime(room);
      room.winner = timeoutLoser === "black" ? "white" : "black";
      room.timeLoser = timeoutLoser;
      room.status = "finished";
      await saveRoom(room);
      await updateLeaderboard(room, room.winner);
      return new Response(JSON.stringify({ ok: false, error: "思考超时，对方获胜" }), { status: 400 });
    }

    if (playerColor !== room.currentTurn) {
      return new Response(JSON.stringify({ ok: false, error: "还没轮到你" }), { status: 400 });
    }

    const { row, col } = body;
    const size = room.board.length;
    if (row < 0 || row >= size || col < 0 || col >= size) {
      return new Response(JSON.stringify({ ok: false, error: "位置无效" }), { status: 400 });
    }

    if (room.board[row][col] !== null) {
      return new Response(JSON.stringify({ ok: false, error: "该位置已有棋子" }), { status: 400 });
    }

    // 先结算本回合用时，再落子
    settleUsedTime(room);

    room.board[row][col] = playerColor;
    if (!room.moves) room.moves = [];
    room.moves.push({ row, col, color: playerColor, time: Date.now() });

    // 先判定禁手（仅黑方）；若构成禁手则黑方负
    if (room.forbid && playerColor === "black") {
      const forbidden = checkForbidden(room.board, row, col);
      if (forbidden) {
        const reason = forbidden === "long" ? "长连禁手" : forbidden === "double4" ? "四四禁手" : "三三禁手";
        room.winner = "white";
        room.status = "finished";
        await saveRoom(room);
        await updateLeaderboard(room, room.winner);
        return new Response(JSON.stringify({ ok: true, data: room, notice: `黑方${reason}，白方获胜` }), { status: 200 });
      }
    }

    // 判定胜负（含获胜连线坐标）
    const winLine = findWinLine(room.board, row, col);
    if (winLine) {
      room.winner = playerColor;
      room.winLine = winLine;
      room.status = "finished";
    } else if (isBoardFull(room.board)) {
      room.winner = "draw";
      room.status = "finished";
    } else {
      room.currentTurn = room.currentTurn === "black" ? "white" : "black";
      room.turnStartAt = Date.now();
    }

    await saveRoom(room);

    if (room.winner) {
      await updateLeaderboard(room, room.winner);
    }

    return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
