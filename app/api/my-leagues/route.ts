import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ leagues: [] }, { status: 200 });
  }

  const { data: players, error: playersError } = await supabaseAdmin
    .from("players")
    .select(
      `
      id,
      name,
      league_id,
      leagues (
        id,
        name,
        code,
        created_at
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (playersError) {
    console.error(playersError);

    return NextResponse.json(
      { error: "Failed to load user leagues" },
      { status: 500 }
    );
  }

  const leagues =
    players
      ?.map((player) => {
        const league = Array.isArray(player.leagues)
          ? player.leagues[0]
          : player.leagues;

        if (!league) {
          return null;
        }

        return {
          playerId: player.id,
          playerName: player.name,
          leagueId: league.id,
          leagueName: league.name,
          leagueCode: league.code,
        };
      })
      .filter(Boolean) ?? [];

  return NextResponse.json({ leagues });
}