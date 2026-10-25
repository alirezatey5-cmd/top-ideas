const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const now = () => Math.floor(Date.now() / 1000);
const uid = () => crypto.randomUUID();
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
async function sha(value) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); }
function phoneClean(input) {
  let p = String(input || "").replace(/[\s()-]/g, "");
  if (p.startsWith("+98")) p = "0" + p.slice(3);
  else if (p.startsWith("0098")) p = "0" + p.slice(4);
  return /^09\d{9}$/.test(p) ? p : null;
}
function bodyText(v, max) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }
async function readJson(req) { try { return await req.json(); } catch { return {}; } }
async function auth(req, env) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const h = await sha(token);
  return env.DB.prepare("SELECT users.id, users.phone, users.nickname FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?").bind(h, now()).first();
}
async function sendSms(env, phone, code) {
  if (!env.KAVENEGAR_API_KEY) throw new Error("SMS_NOT_CONFIGURED");
  const form = new URLSearchParams({ receptor: phone, message: `کد ورود TOP IDEAS: ${code} — این کد را در اختیار کسی قرار ندهید.` });
  if (env.KAVENEGAR_SENDER) form.set("sender", env.KAVENEGAR_SENDER);
  const url = `https://api.kavenegar.com/v1/${encodeURIComponent(env.KAVENEGAR_API_KEY)}/sms/send.json`;
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || Number(data?.return?.status) < 200 || Number(data?.return?.status) >= 300) throw new Error("SMS_SEND_FAILED");
}
async function api(req, env, path) {
  const method = req.method;
  if (method === "GET" && path === "/api/health") return json({ ok: true, app: "TOP IDEAS" });
  if (method === "POST" && path === "/api/auth/request") {
    if (!env.OTP_PEPPER) return json({ error: "تنظیم امنیتی OTP_PEPPER انجام نشده است." }, 503);
    const input = await readJson(req); const phone = phoneClean(input.phone);
    if (!phone) return json({ error: "شماره موبایل معتبر نیست." }, 400);
    const t = now();
    const recent = await env.DB.prepare("SELECT last_sent_at FROM otp_codes WHERE phone=?").bind(phone).first();
    if (recent && t - recent.last_sent_at < 60) return json({ error: "برای دریافت کد جدید، یک دقیقه صبر کن." }, 429);
    const recentCount = await env.DB.prepare("SELECT COUNT(*) AS n FROM otp_codes WHERE last_sent_at>? ").bind(t - 3600).first();
    if ((recentCount?.n || 0) > 100) return json({ error: "درخواست‌ها موقتاً محدود شده‌اند." }, 429);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const codeHash = await sha(`${phone}:${code}:${env.OTP_PEPPER || "SET_A_SECRET_PEPPER"}`);
    try { await sendSms(env, phone, code); }
    catch (e) { return json({ error: e.message === "SMS_NOT_CONFIGURED" ? "ارسال پیامک هنوز تنظیم نشده است." : "ارسال پیامک انجام نشد؛ تنظیمات سرویس پیامک را بررسی کن." }, 503); }
    await env.DB.prepare("INSERT INTO otp_codes(phone,code_hash,expires_at,attempts,last_sent_at) VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, last_sent_at=excluded.last_sent_at").bind(phone, codeHash, t + 300, 0, t).run();
    return json({ ok: true, message: "کد تأیید ارسال شد. تا ۵ دقیقه معتبر است." });
  }
  if (method === "POST" && path === "/api/auth/verify") {
    if (!env.OTP_PEPPER) return json({ error: "تنظیم امنیتی OTP_PEPPER انجام نشده است." }, 503);
    const input = await readJson(req); const phone = phoneClean(input.phone); const code = String(input.code || "").trim();
    if (!phone || !/^\d{6}$/.test(code)) return json({ error: "شماره یا کد واردشده معتبر نیست." }, 400);
    const row = await env.DB.prepare("SELECT * FROM otp_codes WHERE phone=?").bind(phone).first();
    if (!row || row.expires_at < now() || row.attempts >= 5) return json({ error: "کد منقضی شده یا تلاش‌ها تمام شده؛ کد تازه بگیر." }, 400);
    const match = await sha(`${phone}:${code}:${env.OTP_PEPPER || "SET_A_SECRET_PEPPER"}`) === row.code_hash;
    if (!match) { await env.DB.prepare("UPDATE otp_codes SET attempts=attempts+1 WHERE phone=?").bind(phone).run(); return json({ error: "کد تأیید اشتباه است." }, 400); }
    await env.DB.prepare("DELETE FROM otp_codes WHERE phone=?").bind(phone).run();
    let user = await env.DB.prepare("SELECT id,phone,nickname FROM users WHERE phone=?").bind(phone).first();
    if (!user) { user = { id: uid(), phone, nickname: `بازیکن_${phone.slice(-4)}` }; await env.DB.prepare("INSERT INTO users(id,phone,nickname,created_at) VALUES(?,?,?,?)").bind(user.id, phone, user.nickname, now()).run(); }
    const token = `${uid().replaceAll("-", "")}${uid().replaceAll("-", "")}`;
    await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await sha(token), user.id, now() + 60 * 60 * 24 * 30, now()).run();
    return json({ ok: true, token, user: { nickname: user.nickname, phone: user.phone } });
  }
  if (method === "GET" && path === "/api/ideas") {
    const { results } = await env.DB.prepare("SELECT id,title,category,body,nickname,created_at FROM ideas ORDER BY created_at DESC LIMIT 100").all();
    return json({ items: results || [] });
  }
  if (method === "POST" && path === "/api/ideas") {
    const user = await auth(req, env); if (!user) return json({ error: "برای ثبت ایده اول وارد شو." }, 401);
    const input = await readJson(req); const title = bodyText(input.title, 90), category = bodyText(input.category, 50), body = bodyText(input.body, 1200), nickname = bodyText(input.nickname, 30) || user.nickname;
    if (title.length < 3 || body.length < 5 || !category) return json({ error: "عنوان و توضیحات را کامل کن." }, 400);
    const id = uid(), created_at = now();
    await env.DB.prepare("INSERT INTO ideas(id,user_id,title,category,body,nickname,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,user.id,title,category,body,nickname,created_at).run();
    return json({ ok: true, item: { id,title,category,body,nickname,created_at } }, 201);
  }
  if (path === "/api/chat" && method === "GET") {
    const user = await auth(req, env); if (!user) return json({ error: "برای ورود به چت، اول وارد شو." }, 401);
    const after = Math.max(0, Number(new URL(req.url).searchParams.get("after") || 0));
    const { results } = await env.DB.prepare("SELECT id,nickname,body,created_at FROM (SELECT id,nickname,body,created_at FROM chat_messages WHERE created_at>=? ORDER BY created_at DESC LIMIT 100) ORDER BY created_at ASC").bind(after).all();
    return json({ items: results || [], user: { nickname: user.nickname } });
  }
  if (path === "/api/chat" && method === "POST") {
    const user = await auth(req, env); if (!user) return json({ error: "برای ارسال پیام، اول وارد شو." }, 401);
    const input = await readJson(req), body = bodyText(input.body, 500), nickname = bodyText(input.nickname, 24) || user.nickname;
    if (body.length < 1) return json({ error: "پیام خالی است." }, 400);
    const since = now() - 10;
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE user_id=? AND created_at>=?").bind(user.id,since).first();
    if ((count?.n || 0) >= 5) return json({ error: "برای جلوگیری از اسپم کمی صبر کن." }, 429);
    const item = { id: uid(), nickname, body, created_at: now() };
    await env.DB.prepare("INSERT INTO chat_messages(id,user_id,nickname,body,created_at) VALUES(?,?,?,?,?)").bind(item.id,user.id,item.nickname,item.body,item.created_at).run();
    return json({ ok: true, item }, 201);
  }
  if (path === "/api/report" && method === "POST") {
    const user = await auth(req, env); if (!user) return json({ error: "ابتدا وارد شو." }, 401);
    const input = await readJson(req), target_type = bodyText(input.target_type, 20), target_id = bodyText(input.target_id, 80), reason = bodyText(input.reason, 300);
    if (!target_type || !target_id || !reason) return json({ error: "اطلاعات گزارش کامل نیست." }, 400);
    await env.DB.prepare("INSERT INTO abuse_reports(id,reporter_id,target_type,target_id,reason,created_at) VALUES(?,?,?,?,?,?)").bind(uid(),user.id,target_type,target_id,reason,now()).run();
    return json({ ok: true });
  }
  return json({ error: "مسیر پیدا نشد." }, 404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,authorization", "access-control-max-age": "86400" } });
      try { return await api(request, env, url.pathname); }
      catch (e) { return json({ error: "خطای سرور. تنظیمات دیتابیس را بررسی کن." }, 500); }
    }
    return env.ASSETS.fetch(request);
  }
};
