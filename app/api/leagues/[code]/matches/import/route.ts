import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ImportMatch = {
  home_team: string;
  away_team: string;
  start_time: string;
  home_score?: number | null;
  away_score?: number | null;
};

type ImportMatchesBody = {
  matches?: ImportMatch[];
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

  const body = (await request.json()) as ImportMatchesBody;

  if (
    !body.matches ||
    !Array.isArray(body.matches) ||
    body.matches.length === 0
  ) {
    return NextResponse.json(
      { error: "No matches provided" },
      { status: 400 }
    );
  }

  if (body.matches.length > 150) {
    return NextResponse.json(
      { error: "Too many matches. Max is 150" },
      { status: 400 }
    );
  }

  const matchesToInsert = [];

  for (const match of body.matches) {
    const homeTeam = match.home_team?.trim();
    const awayTeam = match.away_team?.trim();
    const startTime = match.start_time?.trim();

    if (!homeTeam || !awayTeam || !startTime) {
      return NextResponse.json(
        { error: "Each match must include home_team, away_team and start_time" },
        { status: 400 }
      );
    }

    const startDate = new Date(startTime);

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: `Invalid start_time: ${startTime}` },
        { status: 400 }
      );
    }

    const hasHomeScore =
      match.home_score !== undefined && match.home_score !== null;
    const hasAwayScore =
      match.away_score !== undefined && match.away_score !== null;

    if (hasHomeScore !== hasAwayScore) {
      return NextResponse.json(
        {
          error:
            "If score is provided, both home_score and away_score are required",
        },
        { status: 400 }
      );
    }

    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let status = "upcoming";

    if (hasHomeScore && hasAwayScore) {
      const homeScoreNumber = Number(match.home_score);
      const awayScoreNumber = Number(match.away_score);

      if (
        !Number.isInteger(homeScoreNumber) ||
        !Number.isInteger(awayScoreNumber) ||
        homeScoreNumber < 0 ||
        awayScoreNumber < 0
      ) {
        return NextResponse.json(
          {
            error: `Invalid score for match: ${homeTeam} vs ${awayTeam}`,
          },
          { status: 400 }
        );
      }

      homeScore = homeScoreNumber;
      awayScore = awayScoreNumber;
      status = "finished";
    }

    matchesToInsert.push({
      league_id: ownerCheck.league.id,
      home_team: homeTeam,
      away_team: awayTeam,
      start_time: startDate.toISOString(),
      status,
      home_score: homeScore,
      away_score: awayScore,
    });
  }

  const { data: insertedMatches, error: insertError } = await supabaseAdmin
    .from("matches")
    .insert(matchesToInsert)
    .select();

  if (insertError) {
    console.error(insertError);

    return NextResponse.json(
      { error: "Failed to import matches" },
      { status: 500 }
    );
  }

  const finishedCount =
    insertedMatches?.filter((match) => match.status === "finished").length || 0;

  const upcomingCount =
    insertedMatches?.filter((match) => match.status === "upcoming").length || 0;

  return NextResponse.json(
    {
      imported: insertedMatches?.length || 0,
      finished: finishedCount,
      upcoming: upcomingCount,
      matches: insertedMatches || [],
    },
    { status: 201 }
  );
}