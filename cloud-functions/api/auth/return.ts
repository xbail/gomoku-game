const BASE = "https://open.juhedenglu.cn/connect.php";

function getEnv(env?: Record<string, string>): { appid: string; appkey: string } {
  const g = globalThis as Record<string, unknown>;
  const proc = g.process as { env?: Record<string, string> } | undefined;
  const appid = env?.JHDL_APPID || proc?.env?.JHDL_APPID || "";
  const appkey = env?.JHDL_APPKEY || proc?.env?.JHDL_APPKEY || "";
  return { appid, appkey };
}

interface UserInfo { nickname: string; socialUid: string; accessToken: string; avatar: string; gender: string; type: string }

function buildHtml(userInfo: UserInfo): string {
  const data = JSON.stringify(userInfo);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录成功</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f7;color:#333}.card{background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:320px}.spinner{width:36px;height:36px;border:3px solid #e0e0e0;border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}p{font-size:14px;color:#666;margin:0}</style></head><body><div class="card"><div class="spinner"></div><p>登录成功，正在跳转...</p></div><script>try{localStorage.setItem("gomoku_user",${JSON.stringify(data)})}catch(e){}window.location.replace("/")</script></body></html>`;
}

export default async function onRequest(context: { request: Request; env?: Record<string, string> }) {
  try {
    if (context.request.method !== "GET") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
    }

    const url = new URL(context.request.url);
    const code = url.searchParams.get("code") || "";
    const { appid, appkey } = getEnv(context.env);

    if (!code) {
      return new Response(buildHtml({ nickname: "游客", socialUid: "", accessToken: "", avatar: "", gender: "", type: "guest" }), {
        status: 200,
        headers: { "Content-Type": "text/html;charset=utf-8" },
      });
    }

    if (!appid || !appkey) {
      return new Response("<html><body><script>alert('登录配置错误，请重试');window.location.replace('/')</script></body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html;charset=utf-8" },
      });
    }

    // Try qq first, then wechat
    let userInfo: UserInfo | null = null;
    for (const provider of ["qq", "wechat"]) {
      const apiUrl = `${BASE}?act=callback&appid=${encodeURIComponent(appid)}&appkey=${encodeURIComponent(appkey)}&type=${encodeURIComponent(provider)}&code=${encodeURIComponent(code)}`;
      try {
        const resp = await fetch(apiUrl);
        const data = await resp.json() as Record<string, unknown>;
        if (data.code === 0) {
          userInfo = {
            socialUid: String(data.social_uid || ""),
            accessToken: String(data.access_token || ""),
            nickname: String(data.nickname || ""),
            avatar: String(data.faceimg || ""),
            gender: String(data.gender || ""),
            type: provider,
          };
          break;
        }
      } catch { /* try next */ }
    }

    if (!userInfo) {
      return new Response("<html><body><script>alert('登录验证失败，请重试');window.location.replace('/')</script></body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html;charset=utf-8" },
      });
    }

    return new Response(buildHtml(userInfo), {
      status: 200,
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  } catch (e) {
    return new Response(`<html><body><script>alert('登录错误: ${String(e).replace(/['"]/g, "")}');window.location.replace('/')</script></body></html>`, {
      status: 200,
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  }
}
