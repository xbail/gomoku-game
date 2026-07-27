import { store } from "./_utils";

interface WaitingRoom {
  id: string;
  blackNickname: string;
  createdAt: number;
}

const WAITING_TTL_MS = 3 * 60 * 1000; // 3 minutes

export async function onRequest() {
  try {
    const result = await store.list();
    const rooms: WaitingRoom[] = [];
    const now = Date.now();

    for (const blob of result.blobs) {
      const data = await store.get(blob.key);
      if (!data) continue;
      try {
        const room = JSON.parse(data);
        if (room.status !== "waiting") continue;

        // clean up stale waiting rooms
        if (now - (room.createdAt ?? 0) > WAITING_TTL_MS) {
          await store.delete(blob.key);
          continue;
        }

        if (room.players?.black?.nickname) {
          rooms.push({
            id: room.id,
            blackNickname: room.players.black.nickname,
            createdAt: room.createdAt ?? 0,
          });
        }
      } catch {
        // skip malformed entries
      }
    }

    // newest first
    rooms.sort((a, b) => b.createdAt - a.createdAt);

    return new Response(JSON.stringify({ ok: true, data: rooms }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
