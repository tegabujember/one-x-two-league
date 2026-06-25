import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PlayerActivity = {
  id: string;
  name: string;
  last_seen_at: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const cleanCode = code.trim().toUpperCase();

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("id, owner_id")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  if (league.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: players, error: playersError } = await supabaseAdmin
    .from("players")
    .select("id, name, last_seen_at")
    .eq("league_id", league.id);

  if (playersError) {
    console.error(playersError);

    return NextResponse.json(
      { error: "Failed to load player activity" },
      { status: 500 }
    );
  }

  const sortedPlayers = ((players || []) as PlayerActivity[]).sort((a, b) => {
    if (!a.last_seen_at && !b.last_seen_at) {
      return a.name.localeCompare(b.name, "he");
    }

    if (!a.last_seen_at) return 1;
    if (!b.last_seen_at) return -1;

    return (
      new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
    );
  });

  return NextResponse.json({ players: sortedPlayers });
}
