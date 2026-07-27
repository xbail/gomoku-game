const BASE = "https://open.juhedenglu.cn/connect.php";

function getEnv(env?: Record<string, string>): { appid: string; appkey: string } {
  const g = globalThis as Record<string, unknown>;
  const proc = g.process as { env?: Record<string, string> } | undefined;
  const appid = env?.JHDL_APPID || proc?.env?.JHDL_APPID || "";
  const appkey = env?.JHDL_APPKEY || proc?.env?.JHDL_APPKEY || "";
  return { appid, appkey };
}

export default async function onRequest(context: { request: Request; env?: Record<string, string> }) {
  try {
    if (context.request.method !== "GET") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const url = new URL(context.request.url);
    const type = url.searchParams.get("type") || "";
    const code = url.searchParams.get("code") || "";
    const { appid, appkey } = getEnv(context.env);

    if (!type || !code) {
      return new Response(JSON.stringify({ ok: false, error: "缺少 type 或 code" }), { status: 400 });
    }

    if (!appid || !appkey) {
      return new Response(JSON.stringify({ ok: false, error: "未配置聚合登录参数" }), { status: 500 });
    }

    const apiUrl = `${BASE}?act=callback&appid=${encodeURIComponent(appid)}&appkey=${encodeURIComponent(appkey)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;

    const resp = await fetch(apiUrl);
    const data = await resp.json();

    if (data.code !== 0) {
      return new Response(JSON.stringify({ ok: false, error: data.msg || "登录失败" }), { status: 400 });
    }

    return new Response(JSON.stringify({
      ok: true,
      data: {
        socialUid: data.social_uid,
        accessToken: data.access_token,
        nickname: data.nickname,
        avatar: data.faceimg || "",
        gender: data.gender || "",
        type: data.type,
      },
    }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
