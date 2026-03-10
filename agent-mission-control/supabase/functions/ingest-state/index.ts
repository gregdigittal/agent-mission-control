import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // Validate required fields
    if (!body.project || !Array.isArray(body.agents)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: project, agents" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Derive session_id from body or header
    const sessionId =
      body.session_id ||
      req.headers.get("x-session-id") ||
      body.project.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Upsert session — always refresh updated_at so the dashboard
    // knows the session is still alive (prevents false-stale detection)
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

    // Append to event history
    const { error: eventError } = await supabase
      .from("session_events")
      .insert({
        session_id: sessionId,
        event_type: "state_update",
        payload: body,
      });

    if (eventError) throw eventError;

    return new Response(
      JSON.stringify({ ok: true, session_id: sessionId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
