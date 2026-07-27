import { getStore } from "@edgeone/pages-blob";

const store = getStore("GAME_BLOB");

export { store };

export async function getRoom(roomId: string) {
  const data = await store.get(roomId);
  return data ? JSON.parse(data) : null;
}

export async function saveRoom(room: Record<string, unknown>) {
  await store.set(room.id as string, JSON.stringify(room));
}

export async function getRoomStrong(roomId: string) {
  const data = await store.get(roomId, { consistency: "strong" });
  return data ? JSON.parse(data) : null;
}
