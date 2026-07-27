import { getStore } from "@edgeone/pages-blob";

// 命名空间 GAME_BLOB 由平台在首次 getStore 调用时自动创建，控制台无法手动新建。
const store = getStore("GAME_BLOB");

export { store };

export async function getRoom(roomId: string) {
  const data = await store.get(roomId);
  return data ? JSON.parse(data) : null;
}

export async function saveRoom(room: Record<string, unknown>) {
  room.lastActiveAt = Date.now();
  await store.set(room.id as string, JSON.stringify(room));
}

export async function getRoomStrong(roomId: string) {
  const data = await store.get(roomId, { consistency: "strong" });
  return data ? JSON.parse(data) : null;
}

// 标记房间有活动（心跳/轮询时调用，避免频繁写盘可节流）
export async function touchRoom(room: Record<string, unknown>, force = false) {
  const now = Date.now();
  const lastActive = (room.lastActiveAt as number) ?? 0;
  if (force || now - lastActive > 30_000) {
    room.lastActiveAt = now;
    await store.set(room.id as string, JSON.stringify(room));
  }
}

export async function deleteRoom(roomId: string) {
  await store.delete(roomId);
}
