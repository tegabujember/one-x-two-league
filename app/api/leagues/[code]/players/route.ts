import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getConfirmedUser,
  isEmailNotConfirmedError,
  isUniqueIndexError,
  PLAYER_ERROR_CODES,
} from "@/lib/verifiedUser";

type JoinLeagueBody = {
  name?: string;
};

function normalizePlayerName(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

async function isPlayerNameTaken(leagueId: string, playerName: string) {
  const { data: players, error } = await supabaseAdmin
    .from("players")
    .select("name")
    .eq("league_id", leagueId);

  if (error) {
    return { isTaken: false, error };
  }

  const normalizedName = normalizePlayerName(playerName);

  return {
    isTaken: players.some(
      (player) => normalizePlayerName(player.name) === normalizedName
    ),
    error: null,
  };
}

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

  const requestedName = new URL(request.url).searchParams.get("name")?.trim();

  if (!existingPlayer && requestedName) {
    const { isTaken, error: nameCheckError } = await isPlayerNameTaken(
      league.id,
      requestedName
    );

    if (nameCheckError) {
      console.error(nameCheckError);

      return NextResponse.json(
        { error: "Failed to check player name" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      player: null,
      alreadyJoined: false,
      nameTaken: isTaken,
    });
  }

  return NextResponse.json({
    player: existingPlayer,
    alreadyJoined: Boolean(existingPlayer),
    nameTaken: false,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const cleanCode = code.trim().toUpperCase();

  const { user, error: userError } = await getConfirmedUser();

  if (userError === "NOT_AUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (userError === PLAYER_ERROR_CODES.emailNotConfirmed) {
    return NextResponse.json(
      {
        error: PLAYER_ERROR_CODES.emailNotConfirmed,
        code: PLAYER_ERROR_CODES.emailNotConfirmed,
      },
      { status: 403 }
    );
  }

  if (!user) {
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
        error: PLAYER_ERROR_CODES.alreadyInLeague,
        code: PLAYER_ERROR_CODES.alreadyInLeague,
        player: existingPlayer,
        alreadyJoined: true,
      },
      { status: 409 }
    );
  }

  const { isTaken, error: nameCheckError } = await isPlayerNameTaken(
    league.id,
    playerName
  );

  if (nameCheckError) {
    console.error(nameCheckError);

    return NextResponse.json(
      { error: "Failed to check player name" },
      { status: 500 }
    );
  }

  if (isTaken) {
    return NextResponse.json(
      {
        error: PLAYER_ERROR_CODES.playerNameTaken,
        code: PLAYER_ERROR_CODES.playerNameTaken,
      },
      { status: 409 }
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

    if (isEmailNotConfirmedError(playerError)) {
      return NextResponse.json(
        {
          error: PLAYER_ERROR_CODES.emailNotConfirmed,
          code: PLAYER_ERROR_CODES.emailNotConfirmed,
        },
        { status: 403 }
      );
    }

    if (
      isUniqueIndexError(playerError, "players_league_name_ci_uidx")
    ) {
      return NextResponse.json(
        {
          error: PLAYER_ERROR_CODES.playerNameTaken,
          code: PLAYER_ERROR_CODES.playerNameTaken,
        },
        { status: 409 }
      );
    }

    if (isUniqueIndexError(playerError, "players_league_user_uidx")) {
      const { data: concurrentPlayer } = await supabaseAdmin
        .from("players")
        .select("id, league_id, name, user_id")
        .eq("league_id", league.id)
        .eq("user_id", user.id)
        .maybeSingle();

      return NextResponse.json(
        {
          error: PLAYER_ERROR_CODES.alreadyInLeague,
          code: PLAYER_ERROR_CODES.alreadyInLeague,
          player: concurrentPlayer,
          alreadyJoined: Boolean(concurrentPlayer),
        },
        { status: 409 }
      );
    }

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
