import { store } from "./room/_utils";

const LEADERBOARD_KEY = "_leaderboard";

export async function onRequest() {
  try {
    const raw = await store.get(LEADERBOARD_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
