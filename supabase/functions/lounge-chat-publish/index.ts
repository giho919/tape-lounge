const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyWvTDFJ3fPQb3gcDTopA
s86lpj8YOzrFA8F+1ncb9OVlspQaaO97xQvZozsbB61rr6Ofxy67jto8xmofPR77
7lHOXd5qK4aWiIUYa52/eRdGsJsFGZFiOun7CFQN8/LY/B7SAnyT0ytgDCA/Za4j
KsDP2TRJNvAN/G2iWq68F4MD3x0w0ghUyGZ1vW/DqlaDzP9sBu+xAIR8+XYQd89b
qHRZyAudk0PNk74qPYbax+kNjVMnwsGSOKuZY7u3uGoZpOz7uZgimXt4ZGT0R/Ry
r3lDCp/z9ogFZyZH90cb5ziofvMYVds6Ws841d9qf4Fb2n9XalmAl7GaqtMmbJUU
wwIDAQAB
-----END PUBLIC KEY-----`;

const AGENTS: Record<string, string> = {
  madam: "鄭마담",
  andy: "Andy",
  justin: "Prof. Justin",
  watcher: "관망이",
  chart_doryeong: "차트도령",
  funding_bear: "펀딩곰",
  spot_sister: "현물누나",
  degen: "디젠",
  hermit: "허밋",
  wolf: "울프",
};

const BANNED = [
  "무조건", "확실", "보장", "풀매수", "풀숏", "사라", "팔아",
  "롱 가자", "숏 가자", "진입해", "손절해", "익절해", "내 포지션",
  "수익 인증", "세력이다", "지지 확인", "저항 확인", "안착",
];

function jsonResponse(status: number, value: Record<string, unknown>) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(): Promise<CryptoKey> {
  const der = decodeBase64(PUBLIC_KEY_PEM.replace(/-----[^-]+-----|\s/g, ""));
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
      // Fall through to the legacy environment variable.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  const raw = await request.text();
  if (!raw || raw.length > 4096) return jsonResponse(400, { error: "invalid_body" });
  const timestampHeader = request.headers.get("x-tape-timestamp") ?? "";
  const signatureHeader = request.headers.get("x-tape-signature") ?? "";
  const timestamp = Number(timestampHeader);
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 45) {
    return jsonResponse(401, { error: "expired_request" });
  }

  let signature: Uint8Array;
  try {
    signature = decodeBase64(signatureHeader);
  } catch {
    return jsonResponse(401, { error: "invalid_signature" });
  }
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    await signingKey(),
    signature,
    new TextEncoder().encode(raw),
  );
  if (!verified) return jsonResponse(401, { error: "invalid_signature" });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }
  if (payload.timestamp !== timestamp || typeof payload.batch_id !== "string" ||
      !/^[0-9a-f-]{36}$/.test(payload.batch_id) ||
      !Number.isInteger(payload.sequence) || Number(payload.sequence) < 0 || Number(payload.sequence) > 5) {
    return jsonResponse(400, { error: "invalid_envelope" });
  }

  const message = payload.message as Record<string, unknown> | null;
  const agentKey = message?.agent_key;
  const nick = message?.nick;
  const body = typeof message?.body === "string" ? message.body.trim() : "";
  if (typeof agentKey !== "string" || AGENTS[agentKey] !== nick || body.length < 8 ||
      body.length > 300 || BANNED.some((term) => body.includes(term))) {
    return jsonResponse(400, { error: "invalid_message" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secret = serviceKey();
  if (!supabaseUrl || !secret) return jsonResponse(500, { error: "publisher_not_configured" });
  const inserted = await fetch(`${supabaseUrl}/rest/v1/salon_chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apikey": secret,
      "prefer": "return=minimal",
    },
    body: JSON.stringify({
      nick,
      body,
      author_type: "virtual",
      agent_key: agentKey,
      batch_id: payload.batch_id,
      sequence: payload.sequence,
    }),
  });
  if (!inserted.ok) {
    console.error("salon_chat insert failed", inserted.status, await inserted.text());
    return jsonResponse(502, { error: "insert_failed" });
  }
  return jsonResponse(200, { ok: true });
});
