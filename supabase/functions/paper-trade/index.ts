import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYMBOL = "BTCUSDT";
const ALLOWED_ORIGINS = new Set(["https://tapelounge.com", "https://giho919.github.io", "http://localhost:3000", "http://127.0.0.1:3000"]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://tapelounge.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers:{...cors(req), "Content-Type":"application/json", "Cache-Control":"no-store"}});
}

// 자리를 비운 구간이 길면 더 굵은 봉으로 훑는다. 굵은 봉의 고저는 그 안의 1분봉
// 고저를 모두 품으므로, 청산이 있었는지 여부는 그대로 잡힌다 (시각만 덜 정밀해진다).
function scanPlan(gapMs: number) {
  if (gapMs <= 900 * 60_000) return { interval: "1m", span: 60_000 };
  if (gapMs <= 900 * 3_600_000) return { interval: "1h", span: 3_600_000 };
  return { interval: "1d", span: 86_400_000 };
}

async function currentPrice(): Promise<number> {
  const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${SYMBOL}`);
  if (!r.ok) throw new Error("NO_PRICE");
  const j = await r.json() as { price?: string };
  const p = Number(j?.price);
  if (!Number.isFinite(p) || p <= 0) throw new Error("NO_PRICE");
  return p;
}

// [openMs, high, low] 만 넘긴다 (청산 판정에 필요한 것뿐)
async function scanBars(checkedMs: number, now: number): Promise<number[][]> {
  const gap = now - checkedMs;
  if (!checkedMs || gap <= 0) return [];
  const { interval, span } = scanPlan(gap);
  const limit = Math.min(1000, Math.ceil(gap / span) + 2);
  const url = `https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=${interval}&startTime=${checkedMs}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const raw = await r.json() as unknown[][];
  if (!Array.isArray(raw)) return [];
  return raw.map(k => [Number(k[0]), Number(k[2]), Number(k[3])])
            .filter(b => b.every(Number.isFinite));
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const known = ["INVALID_ACTION","INVALID_ORDER","INSUFFICIENT_MARGIN","NO_PRICE"];
  return known.find(code => message.includes(code)) || "SERVER_ERROR";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors(req)});
  if (req.method !== "POST") return reply(req, {error:"METHOD_NOT_ALLOWED"}, 405);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return reply(req, {error:"AUTH_REQUIRED"}, 401);
    const service = createClient(SUPABASE_URL, SERVICE_KEY, {auth:{persistSession:false, autoRefreshToken:false}});
    const {data:{user}, error:userError} = await service.auth.getUser(jwt);
    if (userError || !user) return reply(req, {error:"AUTH_REQUIRED"}, 401);

    const body = await req.json();
    const action = String(body?.action || "state");
    const nick = String(body?.nick || "").replace(/\s+/g, " ").trim().slice(0, 10);
    if (!["state","buy","sell","leverage"].includes(action)) return reply(req, {error:"INVALID_ACTION"}, 400);

    // 청산 판정에 필요한 만큼만 봉을 받아 온다 (포지션이 없으면 생략)
    const {data: acct} = await service.from("paper_accounts")
      .select("checked_ms, pos").eq("user_id", user.id).maybeSingle();
    const now = Date.now();
    const holding = !!acct?.pos;
    const [price, bars] = await Promise.all([
      currentPrice(),
      holding ? scanBars(Number(acct?.checked_ms || 0), now) : Promise.resolve([] as number[][]),
    ]);

    const {data, error} = await service.rpc("paper_apply_internal", {
      p_user_id: user.id,
      p_action: action,
      p_pct: Number(body?.pct) || 0,
      p_lev: Number(body?.lev) || 1,
      p_price: price,
      p_now_ms: now,
      p_bars: bars,
    });
    if (error) throw error;
    // 주문에 실린 라운지 닉네임을 랭킹 표시용으로 저장한다 (없으면 그대로)
    if ((action === "buy" || action === "sell") && nick) {
      await service.from("paper_accounts").update({ nick }).eq("user_id", user.id);
    }
    return reply(req, data);
  } catch (error) {
    return reply(req, {error:safeError(error)}, 400);
  }
});
