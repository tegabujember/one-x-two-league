import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type JoinLeagueBody = {
  name?: string;
};

export async function GET(
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
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("id, code")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { data: existingPlayer, error: existingPlayerError } =
    await supabaseAdmin
      .from("players")
      .select("id, league_id, name, user_id")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .maybeSingle();

  if (existingPlayerError) {
    console.error(existingPlayerError);

    return NextResponse.json(
      { error: "Failed to check existing player" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    player: existingPlayer,
    alreadyJoined: Boolean(existingPlayer),
  });
}

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
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as JoinLeagueBody;
  const playerName = body.name?.trim();

  if (!playerName) {
    return NextResponse.json(
      { error: "Player name is required" },
      { status: 400 }
    );
  }

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("id, code")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const { data: existingPlayer, error: existingPlayerError } =
    await supabaseAdmin
      .from("players")
      .select("id, league_id, name, user_id")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .maybeSingle();

  if (existingPlayerError) {
    console.error(existingPlayerError);

    return NextResponse.json(
      { error: "Failed to check existing player" },
      { status: 500 }
    );
  }

  if (existingPlayer) {
    return NextResponse.json(
      {
        player: existingPlayer,
        alreadyJoined: true,
      },
      { status: 200 }
    );
  }

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .insert({
      league_id: league.id,
      name: playerName,
      user_id: user.id,
    })
    .select("id, league_id, name, user_id")
    .single();

  if (playerError || !player) {
    console.error(playerError);

    return NextResponse.json(
      { error: "Failed to join league" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      player,
      alreadyJoined: false,
    },
    { status: 201 }
  );
}
