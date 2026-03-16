import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// In-memory rate limiter: track request timestamps per token (resets on cold start)
const rateLimiter = new Map<string, number[]>();
const RATE_LIMIT = 60;       // max requests per window
const RATE_WINDOW = 60000;   // 1-minute window (ms)
const MAX_BODY_BYTES = 131072; // 128 KB max payload

function isRateLimited(token: string): boolean {
  const now = Date.now();
  const times = (rateLimiter.get(token) || []).filter((t) => now - t < RATE_WINDOW);
  if (times.length >= RATE_LIMIT) return true;
  times.push(now);
  rateLimiter.set(token, times);
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7).trim();

  // Validate token against AMC_WRITE_SECRET (if set) or the anon key.
  // AMC_WRITE_SECRET is a custom secret stored as a Supabase edge function secret —
  // set it with: supabase secrets set AMC_WRITE_SECRET=<your-secret>
  // If not set, falls back to accepting the project anon key (lower security).
  const writeSecret = Deno.env.get("AMC_WRITE_SECRET");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  const validToken = writeSecret ? token === writeSecret : token === anonKey;
  if (!validToken) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (isRateLimited(token)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  // ── Content-type guard ───────────────────────────────────────────────────
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
      status: 415,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Body size guard ───────────────────────────────────────────────────
    const bodyBytes = await req.arrayBuffer();
    if (bodyBytes.byteLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large (max 128 KB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = JSON.parse(new TextDecoder().decode(bodyBytes));

    // ── Schema validation ─────────────────────────────────────────────────
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: "Body must be a JSON object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.project || typeof body.project !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: project (string)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!Array.isArray(body.agents)) {
      return new Response(
        JSON.stringify({ error: "Missing required field: agents (array)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Persist ───────────────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sessionId =
      body.session_id ||
      req.headers.get("x-session-id") ||
      body.project.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const { error: upsertError } = await supabase.from("sessions").upsert(
      {
        id: sessionId,
        project: body.project,
        state: body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (upsertError) throw upsertError;

    const { error: eventError } = await supabase.from("session_events").insert({
      session_id: sessionId,
      event_type: "state_update",
      payload: body,
    });
    if (eventError) throw eventError;

    return new Response(
      JSON.stringify({ ok: true, session_id: sessionId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
