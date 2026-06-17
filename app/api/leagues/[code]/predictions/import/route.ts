import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ImportPrediction = {
  home_team: string;
  away_team: string;
  start_time: string;
  pick: "1" | "X" | "2";
};

type ImportPredictionsBody = {
  player_id?: string;
  predictions?: ImportPrediction[];
};

type MatchRow = {
  id: string;
  league_id: string;
  home_team: string;
  away_team: string;
  start_time: string;
};

async function verifyLeagueOwner(code: string, userId: string) {
  const cleanCode = code.trim().toUpperCase();

  const { data: league, error } = await supabaseAdmin
    .from("leagues")
    .select("id, owner_id")
    .eq("code", cleanCode)
    .single();

  if (error || !league) {
    return { error: "League not found", status: 404, league: null };
  }

  if (league.owner_id !== userId) {
    return { error: "Forbidden", status: 403, league: null };
  }

  return { error: null, status: 200, league };
}

function normalizeTeamName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function makeMatchKey(homeTeam: string, awayTeam: string, startTime: string) {
  const normalizedDate = normalizeDate(startTime);

  if (!normalizedDate) {
    return null;
  }

  return `${normalizeTeamName(homeTeam)}__${normalizeTeamName(
    awayTeam
  )}__${normalizedDate}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ownerCheck = await verifyLeagueOwner(code, user.id);

  if (!ownerCheck.league) {
    return NextResponse.json(
      { error: ownerCheck.error },
      { status: ownerCheck.status }
    );
  }

  const body = (await request.json()) as ImportPredictionsBody;

  const playerId = body.player_id?.trim();

  if (!playerId) {
    return NextResponse.json(
      { error: "player_id is required" },
      { status: 400 }
    );
  }

  if (
    !body.predictions ||
    !Array.isArray(body.predictions) ||
    body.predictions.length === 0
  ) {
    return NextResponse.json(
      { error: "No predictions provided" },
      { status: 400 }
    );
  }

  if (body.predictions.length > 150) {
    return NextResponse.json(
      { error: "Too many predictions. Max is 150" },
      { status: 400 }
    );
  }

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("id, league_id")
    .eq("id", playerId)
    .eq("league_id", ownerCheck.league.id)
    .single();

  if (playerError || !player) {
    return NextResponse.json(
      { error: "Player not found in this league" },
      { status: 404 }
    );
  }

  const { data: leagueMatches, error: matchesError } = await supabaseAdmin
    .from("matches")
    .select("id, league_id, home_team, away_team, start_time")
    .eq("league_id", ownerCheck.league.id);

  if (matchesError || !leagueMatches) {
    console.error(matchesError);

    return NextResponse.json(
      { error: "Failed to load league matches" },
      { status: 500 }
    );
  }

  const matchMap = new Map<string, MatchRow>();

  for (const match of leagueMatches as MatchRow[]) {
    const key = makeMatchKey(
      match.home_team,
      match.away_team,
      match.start_time
    );

    if (key) {
      matchMap.set(key, match);
    }
  }

  const rowsToInsert: {
    match_id: string;
    player_id: string;
    pick: "1" | "X" | "2";
  }[] = [];

  const notFound: ImportPrediction[] = [];
  const invalid: ImportPrediction[] = [];

  for (const prediction of body.predictions) {
    const homeTeam = prediction.home_team?.trim();
    const awayTeam = prediction.away_team?.trim();
    const startTime = prediction.start_time?.trim();
    const pick = prediction.pick;

    if (
      !homeTeam ||
      !awayTeam ||
      !startTime ||
      !["1", "X", "2"].includes(pick)
    ) {
      invalid.push(prediction);
      continue;
    }

    const key = makeMatchKey(homeTeam, awayTeam, startTime);

    if (!key) {
      invalid.push(prediction);
      continue;
    }

    const match = matchMap.get(key);

    if (!match) {
      notFound.push(prediction);
      continue;
    }

    rowsToInsert.push({
      match_id: match.id,
      player_id: playerId,
      pick,
    });
  }

  if (invalid.length > 0 || notFound.length > 0) {
    return NextResponse.json(
      {
        error: "Some predictions are invalid or do not match existing games",
        invalid,
        notFound,
      },
      { status: 400 }
    );
  }

  if (rowsToInsert.length === 0) {
    return NextResponse.json({
      imported: 0,
      skippedExisting: 0,
      message: "No predictions to import",
    });
  }

  const matchIds = rowsToInsert.map((row) => row.match_id);

  const { data: existingPredictions, error: existingPredictionsError } =
    await supabaseAdmin
      .from("predictions")
      .select("id, match_id, player_id")
      .eq("player_id", playerId)
      .in("match_id", matchIds);

  if (existingPredictionsError) {
    console.error(existingPredictionsError);

    return NextResponse.json(
      { error: "Failed to check existing predictions" },
      { status: 500 }
    );
  }

  const existingMatchIds = new Set(
    (existingPredictions || []).map((prediction) => prediction.match_id)
  );

  const newRowsOnly = rowsToInsert.filter(
    (row) => !existingMatchIds.has(row.match_id)
  );

  if (newRowsOnly.length === 0) {
    return NextResponse.json({
      imported: 0,
      skippedExisting: rowsToInsert.length,
      message: "All predictions already exist",
    });
  }

  const { data: insertedPredictions, error: insertError } = await supabaseAdmin
    .from("predictions")
    .insert(newRowsOnly)
    .select();

  if (insertError) {
    console.error(insertError);

    return NextResponse.json(
      { error: "Failed to import predictions" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      imported: insertedPredictions?.length || 0,
      skippedExisting: rowsToInsert.length - newRowsOnly.length,
      predictions: insertedPredictions || [],
    },
    { status: 201 }
  );
}