import { getRoomStrong, saveRoom, store } from "./_utils";
import { checkWin, isBoardFull } from "./_game";

const LEADERBOARD_KEY = "_leaderboard";

async function updateLeaderboard(room: Record<string, unknown>, winner: string | null) {
  const raw = await store.get(LEADERBOARD_KEY);
  const board: Record<string, { nickname: string; wins: number; losses: number; draws: number }> = raw ? JSON.parse(raw) : {};

  const players = [
    { key: (room.players as any)?.black?.nickname, nickname: (room.players as any)?.black?.nickname },
    { key: (room.players as any)?.white?.nickname, nickname: (room.players as any)?.white?.nickname },
  ];

  for (const p of players) {
    if (!p.key) continue;
    if (!board[p.key]) board[p.key] = { nickname: p.nickname || p.key, wins: 0, losses: 0, draws: 0 };
  }

  if (winner === "draw") {
    for (const p of players) {
      if (p.key) board[p.key].draws += 1;
    }
  } else if (winner) {
    const winnerKey = winner === "black" ? players[0].key : players[1].key;
    const loserKey = winner === "black" ? players[1].key : players[0].key;
    if (winnerKey) board[winnerKey].wins += 1;
    if (loserKey) board[loserKey].losses += 1;
  }

  await store.set(LEADERBOARD_KEY, JSON.stringify(board));
}

interface MoveBody {
  roomId: string;
  nickname: string;
  row: number;
  col: number;
}

export async function onRequest(context: { request: Request }) {
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

    const playerColor = room.players.black.nickname === body.nickname ? "black" : room.players.white?.nickname === body.nickname ? "white" : null;
    if (!playerColor) {
      return new Response(JSON.stringify({ ok: false, error: "你不是本局玩家" }), { status: 400 });
    }

    if (playerColor !== room.currentTurn) {
      return new Response(JSON.stringify({ ok: false, error: "还没轮到你" }), { status: 400 });
    }

    const { row, col } = body;
    if (row < 0 || row >= 15 || col < 0 || col >= 15) {
      return new Response(JSON.stringify({ ok: false, error: "位置无效" }), { status: 400 });
    }

    if (room.board[row][col] !== null) {
      return new Response(JSON.stringify({ ok: false, error: "该位置已有棋子" }), { status: 400 });
    }

    room.board[row][col] = playerColor;

    const winner = checkWin(room.board, row, col);
    if (winner) {
      room.winner = winner;
      room.status = "finished";
    } else if (isBoardFull(room.board)) {
      room.winner = "draw";
      room.status = "finished";
    } else {
      room.currentTurn = room.currentTurn === "black" ? "white" : "black";
    }

    await saveRoom(room);

    if (room.winner) {
      await updateLeaderboard(room, room.winner);
    }

    return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
