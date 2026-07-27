import { getStore as _getStore } from "@edgeone/pages-blob";

const STORE_NAME = "GAME_BLOB";

/**
 * Blob Storage 不可用时抛出的友好错误。
 * 附带可操作提示，告诉用户去 EdgeOne 控制台创建命名空间。
 */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "StorageError";
    if (options?.cause) (this as Record<string, unknown>).cause = options.cause;
  }
}

type Store = ReturnType<typeof _getStore>;
let _store: Store | null = null;

/**
 * 懒加载 Blob Store。
 * 首次访问时才初始化，避免在模块加载阶段抛错导致所有接口 502。
 * 若控制台未创建名为 STORE_NAME 的 Blob Storage 命名空间，抛出 StorageError。
 */
function getStoreInstance(): Store {
  if (_store) return _store;
  try {
    _store = _getStore(STORE_NAME);
    return _store;
  } catch (e) {
    throw new StorageError(
      `存储服务未就绪：请在 EdgeOne 控制台「站点设置 → 存储 → Blob Storage」中创建名为 "${STORE_NAME}" 的命名空间后再试。`,
      { cause: e },
    );
  }
}

/**
 * 懒加载的 store 代理，兼容各接口里 `store.get/set/list/delete` 的直接调用。
 * 任何存储异常都会被转换成带操作提示的 StorageError。
 */
export const store: Store = new Proxy({} as Store, {
  get(_target, prop, receiver) {
    const target = getStoreInstance();
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function"
      ? value.bind(target)
      : value;
  },
});

/** 将任意存储异常转换为 StorageError（已是 StorageError 的则原样抛出） */
function toStorageError(op: string, e: unknown): StorageError {
  if (e instanceof StorageError) return e;
  const detail = e instanceof Error ? e.message : String(e);
  return new StorageError(`存储操作「${op}」失败：${detail}`, { cause: e });
}

export async function getRoom(roomId: string) {
  try {
    const data = await store.get(roomId);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    throw toStorageError(`读取房间 ${roomId}`, e);
  }
}

export async function saveRoom(room: Record<string, unknown>) {
  room.lastActiveAt = Date.now();
  try {
    await store.set(room.id as string, JSON.stringify(room));
  } catch (e) {
    throw toStorageError(`保存房间 ${room.id}`, e);
  }
}

export async function getRoomStrong(roomId: string) {
  try {
    const data = await store.get(roomId, { consistency: "strong" });
    return data ? JSON.parse(data) : null;
  } catch (e) {
    throw toStorageError(`强一致读取房间 ${roomId}`, e);
  }
}

// 标记房间有活动（心跳/轮询时调用，避免频繁写盘可节流）
export async function touchRoom(room: Record<string, unknown>, force = false) {
  const now = Date.now();
  if (force || now - (room.lastActiveAt ?? 0) > 30_000) {
    room.lastActiveAt = now;
    try {
      await store.set(room.id as string, JSON.stringify(room));
    } catch (e) {
      throw toStorageError(`刷新房间心跳 ${room.id}`, e);
    }
  }
}

export async function deleteRoom(roomId: string) {
  try {
    await store.delete(roomId);
  } catch (e) {
    throw toStorageError(`删除房间 ${roomId}`, e);
  }
}
