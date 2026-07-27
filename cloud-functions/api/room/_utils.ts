import { getStore } from "@edgeone/pages-blob";

// 命名空间 GAME_BLOB 由平台在首次 getStore 调用时自动创建，控制台无法手动新建。
// 云函数能正确加载本 SDK 的前提：edgeone.json 中已配置
//   "node-functions": { "external_node_modules": ["@edgeone/pages-blob"] }
// 否则构建器不会把该依赖打包进云函数产物，import 直接失败、所有接口 500。
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
  if (force || now - (room.lastActiveAt ?? 0) > 30_000) {
    room.lastActiveAt = now;
    await store.set(room.id as string, JSON.stringify(room));
  }
}

export async function deleteRoom(roomId: string) {
  await store.delete(roomId);
}
