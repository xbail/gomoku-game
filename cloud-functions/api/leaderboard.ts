import { store, resetLeaderboard } from "./room/_utils";

const LEADERBOARD_KEY = "_leaderboard";
const LEADERBOARD_VERSION = 2;

export default async function onRequest(context: { request: Request }) {
  try {
    // 支持重置排行榜：GET /api/leaderboard?reset=1
    const url = new URL(context.request.url);
    if (url.searchParams.get("reset") === "1") {
      await resetLeaderboard();
      return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    }

    // 强一致读：返回最新的排行榜数据，避免展示陈旧/缺失的条目
    const raw = await store.get(LEADERBOARD_KEY, { consistency: "strong" });
    if (!raw) {
      return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    }

    let parsed: { version?: number; entries?: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // JSON 解析失败，返回空并重置
      await resetLeaderboard();
      return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    }

    // 旧格式数据（无 version 或版本不匹配）→ 自动清空
    if (!parsed.version || parsed.version !== LEADERBOARD_VERSION) {
      await resetLeaderboard();
      return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    }

    // 返回有效条目
    const entries = (parsed.entries && typeof parsed.entries === "object") ? parsed.entries : {};
    return new Response(JSON.stringify({ ok: true, data: entries }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
