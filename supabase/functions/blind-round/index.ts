import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STOCKS_URL = "https://tapelounge.com/reports/stocks.json";
const TOTAL = 460;
const CRYPTO_POOL = ["BTCUSDT","ETHUSDT","BNBUSDT","XRPUSDT","ADAUSDT","LTCUSDT","LINKUSDT","TRXUSDT","XLMUSDT","ETCUSDT","EOSUSDT"];
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
function rng(seed: number) {
  let a = seed | 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function isoDay(ms: number) { return new Date(ms).toISOString().slice(0, 10); }
function normalize(raw: unknown[][]) {
  if (!Array.isArray(raw) || raw.length !== TOTAL) throw new Error("ROUND_DATA_UNAVAILABLE");
  const base = Number(raw[259]?.[4]);
  if (!Number.isFinite(base) || base <= 0) throw new Error("ROUND_DATA_INVALID");
  return raw.map((k, i) => [
    946684800000 + i * 86400000,
    Number(k[1]) / base * 100, Number(k[2]) / base * 100,
    Number(k[3]) / base * 100, Number(k[4]) / base * 100, Number(k[5]) || 0,
  ]);
}
async function buildRound(track: string, seed: number) {
  const random = rng(seed);
  if (track === "stock") {
    const response = await fetch(STOCKS_URL, {headers:{"Accept":"application/json"}});
    if (!response.ok) throw new Error("ROUND_DATA_UNAVAILABLE");
    const bundle = await response.json() as Record<string, unknown[][]>;
    const symbols = Object.keys(bundle).filter(s => Array.isArray(bundle[s]) && bundle[s].length >= TOTAL).sort();
    if (!symbols.length) throw new Error("ROUND_DATA_UNAVAILABLE");
    const symbol = symbols[Math.floor(random() * symbols.length)];
    const rows = bundle[symbol];
    const end = TOTAL - 1 + Math.floor(random() * (rows.length - TOTAL + 1));
    const raw = rows.slice(end - TOTAL + 1, end + 1);
    return {symbol, real_start:isoDay(Number(raw[259][0])), real_end:isoDay(Number(raw[TOTAL-1][0])), candles:normalize(raw)};
  }

  for (let attempt = 0; attempt < CRYPTO_POOL.length; attempt++) {
    const symbol = CRYPTO_POOL[Math.floor(random() * CRYPTO_POOL.length)];
    const min = Date.parse("2022-01-01T00:00:00Z"), max = Date.now() - 30 * 86400000;
    const endTime = min + Math.floor(random() * ((max - min) / 86400000)) * 86400000;
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${TOTAL}&endTime=${endTime}`);
    if (!response.ok) continue;
    const raw = await response.json() as unknown[][];
    if (!Array.isArray(raw) || raw.length !== TOTAL) continue;
    return {symbol, real_start:isoDay(Number(raw[259][0])), real_end:isoDay(Number(raw[TOTAL-1][0])), candles:normalize(raw)};
  }
  throw new Error("ROUND_DATA_UNAVAILABLE");
}
function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const known = ["NOT_A_MEMBER","ROUND_NOT_OVER","ORDER_NOT_OPEN","INVALID_ORDER","ROUND_DATA_UNAVAILABLE","ROUND_DATA_INVALID"];
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
    const roomId = String(body?.room_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(roomId)) return reply(req, {error:"INVALID_ROOM"}, 400);

    if (body.action === "trade") {
      const {data, error} = await service.rpc("blind_apply_trade_internal", {
        p_room_id:roomId, p_user_id:user.id, p_action:String(body.side || ""), p_pct:Number(body.pct),
        p_lev:Number(body.lev) || 1,
      });
      if (error) throw error;
      return reply(req, data);
    }
    if (body.action === "finish") {
      const {data, error} = await service.rpc("blind_finish_player_internal", {p_room_id:roomId, p_user_id:user.id});
      if (error) throw error;
      return reply(req, data);
    }
    if (body.action !== "round") return reply(req, {error:"INVALID_ACTION"}, 400);

    const {data:meta, error:metaError} = await service.rpc("blind_round_get_internal", {p_room_id:roomId, p_user_id:user.id});
    if (metaError) throw metaError;
    let round = meta.round;
    if (!round) {
      const built = await buildRound(meta.track, Number(meta.seed));
      const {data, error} = await service.rpc("blind_round_store_internal", {
        p_room_id:roomId, p_user_id:user.id, p_symbol:built.symbol,
        p_real_start:built.real_start, p_real_end:built.real_end, p_candles:built.candles,
      });
      if (error) throw error;
      round = data;
    }
    return reply(req, {kl:round.candles});
  } catch (error) {
    return reply(req, {error:safeError(error)}, 400);
  }
});
