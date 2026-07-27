import { store } from "./_utils";

interface WaitingRoom {
  id: string;
  blackNickname: string;
  createdAt: number;
}

interface PlayingRoom {
  id: string;
  blackNickname: string;
  whiteNickname: string;
  createdAt: number;
}

interface RoomList {
  waiting: WaitingRoom[];
  playing: PlayingRoom[];
}

const WAITING_TTL_MS = 3 * 60 * 1000; // 3 minutes

export async function onRequest() {
  try {
    const result = await store.list();
    const waiting: WaitingRoom[] = [];
    const playing: PlayingRoom[] = [];
    const now = Date.now();

    for (const blob of result.blobs) {
      const data = await store.get(blob.key);
      if (!data) continue;
      try {
        const room = JSON.parse(data);
        if (room.status === "waiting") {
          // clean up stale waiting rooms
          if (now - (room.createdAt ?? 0) > WAITING_TTL_MS) {
            await store.delete(blob.key);
            continue;
          }

          if (room.players?.black?.nickname) {
            waiting.push({
              id: room.id,
              blackNickname: room.players.black.nickname,
              createdAt: room.createdAt ?? 0,
            });
          }
        } else if (room.status === "playing" && !room.winner) {
          if (room.players?.black?.nickname && room.players?.white?.nickname) {
            playing.push({
              id: room.id,
              blackNickname: room.players.black.nickname,
              whiteNickname: room.players.white.nickname,
              createdAt: room.createdAt ?? 0,
            });
          }
        }
      } catch {
        // skip malformed entries
      }
    }

    // newest first
    waiting.sort((a, b) => b.createdAt - a.createdAt);
    playing.sort((a, b) => b.createdAt - a.createdAt);

    return new Response(JSON.stringify({ ok: true, data: { waiting, playing } }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
