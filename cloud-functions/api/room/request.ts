import { getRoomStrong, saveRoom, updateLeaderboard } from "./_utils";
import { createEmptyBoard } from "./_game";
import { settleUsedTime } from "./_timer";

type RequestType = "undo" | "draw" | "reset";

interface RequestBody {
  roomId: string;
  nickname: string;
  action: "request" | "accept" | "decline" | "cancel";
  type?: RequestType;       // request 时必填
}

export default async function onRequest(context: { request: Request }) {
  try {
    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const body: RequestBody = await context.request.json();
    if (!body.roomId || !body.nickname || !body.action) {
      return new Response(JSON.stringify({ ok: false, error: "参数不完整" }), { status: 400 });
    }

    const room = await getRoomStrong(body.roomId.trim().toUpperCase());
    if (!room) {
      return new Response(JSON.stringify({ ok: false, error: "房间不存在" }), { status: 404 });
    }

    const me: "black" | "white" | null =
      room.players.black.nickname === body.nickname ? "black"
      : room.players.white?.nickname === body.nickname ? "white"
      : null;
    if (!me) {
      return new Response(JSON.stringify({ ok: false, error: "你不是本局玩家" }), { status: 400 });
    }

    const opp: "black" | "white" = me === "black" ? "white" : "black";

    // ========== 发起请求 ==========
    if (body.action === "request") {
      if (!body.type) {
        return new Response(JSON.stringify({ ok: false, error: "缺少请求类型" }), { status: 400 });
      }
      if (room.request) {
        return new Response(JSON.stringify({ ok: false, error: "已有待处理请求" }), { status: 400 });
      }

      // 仅 playing 阶段可发起 undo/draw；finished 阶段才可发起 reset
      if (body.type === "reset") {
        if (room.status !== "finished") {
          return new Response(JSON.stringify({ ok: false, error: "对局尚未结束" }), { status: 400 });
        }
      } else {
        if (room.status !== "playing" || room.winner) {
          return new Response(JSON.stringify({ ok: false, error: "对局未在进行中" }), { status: 400 });
        }
      }

      // undo 至少需要已有一步可悔
      if (body.type === "undo" && (!room.moves || room.moves.length === 0)) {
        return new Response(JSON.stringify({ ok: false, error: "没有可悔的棋" }), { status: 400 });
      }

      room.request = { type: body.type, from: me, to: opp, createdAt: Date.now() };
      await saveRoom(room);
      return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
    }

    // ========== 处理已有请求 ==========
    if (!room.request) {
      return new Response(JSON.stringify({ ok: false, error: "没有待处理的请求" }), { status: 400 });
    }

    // 取消：仅发起方可取消
    if (body.action === "cancel") {
      if (room.request.from !== me) {
        return new Response(JSON.stringify({ ok: false, error: "只能取消自己发起的请求" }), { status: 400 });
      }
      room.request = null;
      await saveRoom(room);
      return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
    }

    // 接受/拒绝：仅接收方可处理
    if (room.request.to !== me) {
      return new Response(JSON.stringify({ ok: false, error: "该请求不是发给你" }), { status: 400 });
    }

    const req = room.request;

    if (body.action === "decline") {
      room.request = null;
      await saveRoom(room);
      return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
    }

    // ========== 接受请求 ==========
    if (body.action === "accept") {
      room.request = null;

      if (req.type === "undo") {
        // 悔棋：撤回发起方自己刚下的最后一步棋。
        // 从末尾向前找到属于发起方(req.from)的最后一手，撤回它，
        // 同时撤回之后对方可能已下的棋子，回合回到发起方。
        if (room.moves && room.moves.length > 0) {
          // 找到发起方最后一手的索引（从后往前找）
          const fromColor = req.from;
          let undoCount = 0;
          for (let i = room.moves.length - 1; i >= 0; i--) {
            undoCount++;
            if ((room.moves[i] as { color: string }).color === fromColor) {
              break;
            }
          }
          // 撤回 undoCount 步棋子（从末尾开始删）
          for (let i = 0; i < undoCount; i++) {
            const last = room.moves.pop() as { row: number; col: number; color: string };
            room.board[last.row][last.col] = null;
          }
          // 回合回到发起方
          room.currentTurn = fromColor;
          // 禁手已触发终局的悔棋：清除终局状态
          if (room.winner && !room.timeLoser) {
            room.winner = null;
            room.winLine = null;
            room.status = "playing";
          }
          room.turnStartAt = Date.now();
        }
      } else if (req.type === "draw") {
        // 求和：直接平局
        settleUsedTime(room);
        room.winner = "draw";
        room.status = "finished";
        await saveRoom(room);
        await updateLeaderboard(room, "draw");
        return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
      } else if (req.type === "reset") {
        // 再来一局：清空棋盘，双方仍在则 playing
        room.board = createEmptyBoard(room.boardSize || 15);
        room.currentTurn = "black";
        room.winner = null;
        room.winLine = null;
        room.moves = [];
        room.timeLoser = null;
        room.status = room.players.white ? "playing" : "waiting";
        room.turnStartAt = Date.now();
        room.blackUsedMs = 0;
        room.whiteUsedMs = 0;
      }

      await saveRoom(room);
      return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: false, error: "未知操作" }), { status: 400 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
}
