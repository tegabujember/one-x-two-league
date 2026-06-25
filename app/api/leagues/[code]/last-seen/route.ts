import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000;

export async function POST(
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
    .select("id")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("id, last_seen_at")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (playerError) {
    console.error(playerError);

    return NextResponse.json(
      { error: "Failed to load participant" },
      { status: 500 }
    );
  }

  if (!player) {
    return NextResponse.json({ updated: false });
  }

  const now = new Date();
  const lastSeenAt =
    typeof player.last_seen_at === "string"
      ? new Date(player.last_seen_at)
      : null;

  if (
    lastSeenAt &&
    !Number.isNaN(lastSeenAt.getTime()) &&
    now.getTime() - lastSeenAt.getTime() < LAST_SEEN_THROTTLE_MS
  ) {
    return NextResponse.json({ updated: false });
  }

  const { error: updateError } = await supabaseAdmin
    .from("players")
    .update({ last_seen_at: now.toISOString() })
    .eq("id", player.id)
    .eq("league_id", league.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error(updateError);

    return NextResponse.json(
      { error: "Failed to update last seen" },
      { status: 500 }
    );
  }

  return NextResponse.json({ updated: true });
}
