import { store } from "./room/_utils";

const LEADERBOARD_KEY = "_leaderboard";

export default async function onRequest() {
  try {
    // 强一致读：返回最新的排行榜数据，避免展示陈旧/缺失的条目
    const raw = await store.get(LEADERBOARD_KEY, { consistency: "strong" });
    const data = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
