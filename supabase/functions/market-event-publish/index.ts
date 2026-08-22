const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyWvTDFJ3fPQb3gcDTopA
s86lpj8YOzrFA8F+1ncb9OVlspQaaO97xQvZozsbB61rr6Ofxy67jto8xmofPR77
7lHOXd5qK4aWiIUYa52/eRdGsJsFGZFiOun7CFQN8/LY/B7SAnyT0ytgDCA/Za4j
KsDP2TRJNvAN/G2iWq68F4MD3x0w0ghUyGZ1vW/DqlaDzP9sBu+xAIR8+XYQd89b
qHRZyAudk0PNk74qPYbax+kNjVMnwsGSOKuZY7u3uGoZpOz7uZgimXt4ZGT0R/Ry
r3lDCp/z9ogFZyZH90cb5ziofvMYVds6Ws841d9qf4Fb2n9XalmAl7GaqtMmbJUU
wwIDAQAB
-----END PUBLIC KEY-----`;

const TYPES = new Set(["liquidation", "jackpot", "whale", "candle", "breakout", "macro"]);
const TONES = new Set(["up", "dn", "gold"]);
const SIDES = new Set(["long", "short", "buy", "sell", "up", "down"]);

function response(status: number, value: Record<string, unknown>) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function base64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function publicKey(): Promise<CryptoKey> {
  const der = base64(PUBLIC_KEY_PEM.replace(/-----[^-]+-----|\s/g, ""));
  return await crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function serviceKey(): string {
  const bundled = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (bundled) {
    try {
      const keys = JSON.parse(bundled);
      if (typeof keys.default === "string") return keys.default;
    } catch {
      // Fall back to the legacy environment variable.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, { error: "method_not_allowed" });
  const raw = await request.text();
  if (!raw || raw.length > 8192) return response(400, { error: "invalid_body" });
  const timestampHeader = request.headers.get("x-tape-timestamp") ?? "";
  const signatureHeader = request.headers.get("x-tape-signature") ?? "";
  const timestamp = Number(timestampHeader);
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 45) {
    return response(401, { error: "expired_request" });
  }

  let signature: Uint8Array;
  try {
    signature = base64(signatureHeader);
  } catch {
    return response(401, { error: "invalid_signature" });
  }
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    await publicKey(),
    signature,
    new TextEncoder().encode(raw),
  );
  if (!verified) return response(401, { error: "invalid_signature" });

  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return response(400, { error: "invalid_json" });
  }
  if (envelope.timestamp !== timestamp) return response(400, { error: "invalid_envelope" });
  const event = envelope.event as Record<string, unknown> | null;
  if (!event) return response(400, { error: "invalid_event" });

  const eventKey = event.event_key;
  const eventType = event.event_type;
  const eventTime = event.event_time;
  const icon = event.icon;
  const title = event.title;
  const detail = event.detail;
  const tone = event.tone;
  const symbol = event.symbol;
  const side = event.side;
  const importance = event.importance;
  const eventMs = typeof eventTime === "string" ? Date.parse(eventTime) : NaN;
  if (typeof eventKey !== "string" || !/^[a-z0-9:_-]{5,120}$/.test(eventKey) ||
      typeof eventType !== "string" || !TYPES.has(eventType) ||
      !Number.isFinite(eventMs) || eventMs < Date.now() - 24 * 3600_000 || eventMs > Date.now() + 60_000 ||
      typeof icon !== "string" || icon.length < 1 || icon.length > 12 ||
      typeof title !== "string" || title.length < 3 || title.length > 80 ||
      typeof detail !== "string" || detail.length < 5 || detail.length > 240 ||
      typeof tone !== "string" || !TONES.has(tone) ||
      (symbol !== null && typeof symbol !== "string") ||
      (side !== null && (typeof side !== "string" || !SIDES.has(side))) ||
      !Number.isInteger(importance) || Number(importance) < 0 || Number(importance) > 100 ||
      typeof event.is_highlight !== "boolean" ||
      (event.price !== null && (!finite(event.price) || event.price <= 0)) ||
      (event.amount_usd !== null && (!finite(event.amount_usd) || event.amount_usd < 0)) ||
      typeof event.metadata !== "object" || event.metadata === null || Array.isArray(event.metadata) ||
      JSON.stringify(event.metadata).length > 4096) {
    return response(400, { error: "invalid_event" });
  }

  const metadata = event.metadata as Record<string, unknown>;
  if (eventType === "liquidation") {
    const longUsd = metadata.long_usd;
    const shortUsd = metadata.short_usd;
    const count = metadata.count;
    if (symbol !== "ALL" || !finite(event.amount_usd) || event.amount_usd < 100_000 ||
        !finite(longUsd) || !finite(shortUsd) || !Number.isInteger(count) || Number(count) < 1 ||
        Math.abs(longUsd + shortUsd - event.amount_usd) > Math.max(2, event.amount_usd * 0.001)) {
      return response(400, { error: "invalid_liquidation" });
    }
  } else if (eventType === "whale") {
    if (symbol !== "BTCUSDT" || !finite(event.amount_usd) || event.amount_usd < 1_000_000 ||
        (side !== "buy" && side !== "sell")) return response(400, { error: "invalid_whale" });
  } else if (eventType === "candle" || eventType === "breakout") {
    if (symbol !== "BTCUSDT" || (side !== "up" && side !== "down") || !finite(event.price)) {
      return response(400, { error: "invalid_btc_event" });
    }
  } else if (eventType === "jackpot") {
    if (symbol !== "ALL" || !finite(event.amount_usd) || event.amount_usd < 5_000_000 ||
        (side !== "long" && side !== "short")) return response(400, { error: "invalid_jackpot" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secret = serviceKey();
  if (!supabaseUrl || !secret) return response(500, { error: "publisher_not_configured" });
  const stored = await fetch(`${supabaseUrl}/rest/v1/market_events?on_conflict=event_key`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apikey": secret,
      "prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(event),
  });
  if (!stored.ok) {
    console.error("market_events upsert failed", stored.status, await stored.text());
    return response(502, { error: "store_failed" });
  }
  return response(200, { ok: true });
});
