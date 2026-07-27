import { getRoom, saveRoom } from "./_utils";
import { createEmptyBoard } from "./_game";

interface CreateBody {
  nickname: string;
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

    let roomId: string;
    do {
      roomId = generateRoomId();
    } while (await getRoom(roomId));

    const room = {
      id: roomId,
      players: {
        black: { nickname: body.nickname.trim() },
        white: null,
      },
      board: createEmptyBoard(),
      currentTurn: "black",
      winner: null,
      status: "waiting",
      createdAt: Date.now(),
    };

    await saveRoom(room);

    return new Response(JSON.stringify({ ok: true, data: room }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
