import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface SessionPayload {
  game_id: string;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  active_secs: number;
  idle_secs: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { sessions }: { sessions: SessionPayload[] } = await req.json();

  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
    return new Response(
      JSON.stringify({ error: "No sessions provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const rows = sessions.map((s) => ({
    user_id: user.id,
    game_id: s.game_id,
    started_at: s.started_at,
    ended_at: s.ended_at,
    duration_secs: s.duration_secs,
    active_secs: s.active_secs,
    idle_secs: s.idle_secs,
  }));

  const { data, error } = await supabase
    .from("game_sessions")
    .insert(rows)
    .select("id");

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message, inserted: 0 }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ inserted: data?.length ?? 0, errors: [] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
