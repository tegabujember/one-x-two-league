import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateMatchBody = {
  home_team?: string;
  away_team?: string;
  start_time?: string;
};

export async function POST(
  request: Request,
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
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = (await request.json()) as CreateMatchBody;

  const homeTeam = body.home_team?.trim();
  const awayTeam = body.away_team?.trim();
  const startTime = body.start_time?.trim();

  if (!homeTeam || !awayTeam || !startTime) {
    return NextResponse.json(
      { error: "Missing match fields" },
      { status: 400 }
    );
  }

  const startDate = new Date(startTime);

  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid start time" },
      { status: 400 }
    );
  }

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("id, owner_id")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json(
      { error: "League not found" },
      { status: 404 }
    );
  }

  if (league.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .insert({
      league_id: league.id,
      home_team: homeTeam,
      away_team: awayTeam,
      start_time: startDate.toISOString(),
      status: "upcoming",
    })
    .select()
    .single();

  if (matchError || !match) {
    console.error(matchError);

    return NextResponse.json(
      { error: "Failed to create match" },
      { status: 500 }
    );
  }

  return NextResponse.json({ match }, { status: 201 });
}