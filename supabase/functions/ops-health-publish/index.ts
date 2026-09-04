const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyWvTDFJ3fPQb3gcDTopA
s86lpj8YOzrFA8F+1ncb9OVlspQaaO97xQvZozsbB61rr6Ofxy67jto8xmofPR77
7lHOXd5qK4aWiIUYa52/eRdGsJsFGZFiOun7CFQN8/LY/B7SAnyT0ytgDCA/Za4j
KsDP2TRJNvAN/G2iWq68F4MD3x0w0ghUyGZ1vW/DqlaDzP9sBu+xAIR8+XYQd89b
qHRZyAudk0PNk74qPYbax+kNjVMnwsGSOKuZY7u3uGoZpOz7uZgimXt4ZGT0R/Ry
r3lDCp/z9ogFZyZH90cb5ziofvMYVds6Ws841d9qf4Fb2n9XalmAl7GaqtMmbJUU
wwIDAQAB
-----END PUBLIC KEY-----`;

const STATUSES = new Set(["healthy", "degraded", "critical"]);
const REGIMES = new Set(["RISK_ON", "RISK_OFF"]);
const TARGETS = new Set(["ETH", "USDT"]);
const FIELDS = new Set([
  "sample_key", "observed_at", "host_name", "overall_status", "uptime_seconds",
  "load_1m", "cpu_usage_pct", "memory_available_mb", "swap_used_mb",
  "root_disk_used_pct", "disk_read_kbps", "disk_write_kbps", "disk_busy_pct",
  "cpu_temp_c", "gpu_temp_c", "gpu_util_pct", "main_bot_ok",
  "main_bot_heartbeat_at", "signal_candle", "signal_regime", "signal_target",
  "bithumb_timer_ok", "bithumb_last_exit_code", "bithumb_account_1_aligned",
  "bithumb_account_2_aligned", "issues", "details",
]);

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

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function optionalFinite(value: unknown, minimum: number, maximum: number): boolean {
  return value === null || finite(value, minimum, maximum);
}

function optionalTimestamp(value: unknown): boolean {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function optionalBoolean(value: unknown): boolean {
  return value === null || typeof value === "boolean";
}

function validHealth(health: Record<string, unknown>): boolean {
  if (Object.keys(health).some((key) => !FIELDS.has(key))) return false;
  const observedMs = typeof health.observed_at === "string" ? Date.parse(health.observed_at) : NaN;
  const issues = health.issues;
  const details = health.details;
  return (
    typeof health.sample_key === "string" && /^[A-Za-z0-9._:-]{8,120}$/.test(health.sample_key) &&
    typeof health.host_name === "string" && /^[A-Za-z0-9._-]{1,63}$/.test(health.host_name) &&
    Number.isFinite(observedMs) && observedMs >= Date.now() - 10 * 60_000 && observedMs <= Date.now() + 60_000 &&
    typeof health.overall_status === "string" && STATUSES.has(health.overall_status) &&
    Number.isInteger(health.uptime_seconds) && finite(health.uptime_seconds, 0, Number.MAX_SAFE_INTEGER) &&
    finite(health.load_1m, 0, 1_000_000) &&
    finite(health.cpu_usage_pct, 0, 100) &&
    Number.isInteger(health.memory_available_mb) && finite(health.memory_available_mb, 0, 1_000_000_000) &&
    Number.isInteger(health.swap_used_mb) && finite(health.swap_used_mb, 0, 1_000_000_000) &&
    finite(health.root_disk_used_pct, 0, 100) &&
    optionalFinite(health.disk_read_kbps, 0, 1_000_000_000) &&
    optionalFinite(health.disk_write_kbps, 0, 1_000_000_000) &&
    optionalFinite(health.disk_busy_pct, 0, 100) &&
    optionalFinite(health.cpu_temp_c, -50, 150) &&
    optionalFinite(health.gpu_temp_c, -50, 150) &&
    optionalFinite(health.gpu_util_pct, 0, 100) &&
    typeof health.main_bot_ok === "boolean" && optionalTimestamp(health.main_bot_heartbeat_at) &&
    optionalTimestamp(health.signal_candle) &&
    (health.signal_regime === null || (typeof health.signal_regime === "string" && REGIMES.has(health.signal_regime))) &&
    (health.signal_target === null || (typeof health.signal_target === "string" && TARGETS.has(health.signal_target))) &&
    typeof health.bithumb_timer_ok === "boolean" &&
    (health.bithumb_last_exit_code === null ||
      (Number.isInteger(health.bithumb_last_exit_code) && finite(health.bithumb_last_exit_code, -32768, 32767))) &&
    optionalBoolean(health.bithumb_account_1_aligned) &&
    optionalBoolean(health.bithumb_account_2_aligned) &&
    Array.isArray(issues) && issues.length <= 32 &&
    issues.every((issue) => typeof issue === "string" && issue.length >= 1 && issue.length <= 160) &&
    object(details) && JSON.stringify(details).length <= 12_288
  );
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, { error: "method_not_allowed" });
  const raw = await request.text();
  if (!raw || raw.length > 16_384) return response(400, { error: "invalid_body" });

  const timestampHeader = request.headers.get("x-ops-timestamp") ?? "";
  const signatureHeader = request.headers.get("x-ops-signature") ?? "";
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
  if (envelope.timestamp !== timestamp || !object(envelope.health) || !validHealth(envelope.health)) {
    return response(400, { error: "invalid_health" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secret = serviceKey();
  if (!supabaseUrl || !secret) return response(500, { error: "publisher_not_configured" });
  const stored = await fetch(`${supabaseUrl}/rest/v1/ops_health_logs?on_conflict=sample_key`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apikey": secret,
      "prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(envelope.health),
  });
  if (!stored.ok) {
    console.error("ops_health_logs upsert failed", stored.status, await stored.text());
    return response(502, { error: "store_failed" });
  }
  return response(200, { ok: true });
});
