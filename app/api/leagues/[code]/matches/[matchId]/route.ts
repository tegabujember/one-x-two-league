import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateMatchBody = {
  home_team?: string;
  away_team?: string;
  start_time?: string;
  home_score?: number;
  away_score?: number;
  status?: string;

  // רק בייבוא תוצאות:
  // אם למשחק כבר יש תוצאה, אסור לדרוס אותה.
  only_if_no_score?: boolean;
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string; matchId: string }> }
) {
  const { code, matchId } = await context.params;

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

  const body = (await request.json()) as UpdateMatchBody;

  const updateData: UpdateMatchBody = {};

  if (body.home_team !== undefined) {
    const homeTeam = body.home_team.trim();

    if (!homeTeam) {
      return NextResponse.json(
        { error: "Home team is required" },
        { status: 400 }
      );
    }

    updateData.home_team = homeTeam;
  }

  if (body.away_team !== undefined) {
    const awayTeam = body.away_team.trim();

    if (!awayTeam) {
      return NextResponse.json(
        { error: "Away team is required" },
        { status: 400 }
      );
    }

    updateData.away_team = awayTeam;
  }

  if (body.start_time !== undefined) {
    const startDate = new Date(body.start_time);

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid start time" },
        { status: 400 }
      );
    }

    updateData.start_time = startDate.toISOString();
  }

  const isUpdatingScore =
    body.home_score !== undefined || body.away_score !== undefined;

  if (isUpdatingScore) {
    if (
      body.home_score === undefined ||
      body.away_score === undefined ||
      !Number.isInteger(body.home_score) ||
      !Number.isInteger(body.away_score) ||
      body.home_score < 0 ||
      body.away_score < 0
    ) {
      return NextResponse.json(
        { error: "Invalid score" },
        { status: 400 }
      );
    }

    updateData.home_score = body.home_score;
    updateData.away_score = body.away_score;
    updateData.status = "finished";
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  let updateQuery = supabaseAdmin
    .from("matches")
    .update(updateData)
    .eq("id", matchId)
    .eq("league_id", ownerCheck.league.id);

  /*
    בייבוא תוצאות בלבד:
    מעדכן רק כאשר שתי התוצאות עדיין NULL.
    כך גם אם מישהו עדכן בין ה-Preview ללחיצה על אישור,
    הייבוא לא ידרוס את התוצאה.
  */
  if (isUpdatingScore && body.only_if_no_score === true) {
    updateQuery = updateQuery
      .is("home_score", null)
      .is("away_score", null);
  }

  const { data: match, error: matchError } = await updateQuery
    .select()
    .maybeSingle();

  if (matchError) {
    console.error(matchError);

    return NextResponse.json(
      { error: "Failed to update match" },
      { status: 500 }
    );
  }

  if (!match) {
    if (isUpdatingScore && body.only_if_no_score === true) {
      return NextResponse.json(
        {
          error: "Match already has a score or was not found",
          code: "MATCH_ALREADY_HAS_SCORE",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ match });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ code: string; matchId: string }> }
) {
  const { code, matchId } = await context.params;

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

  const { error: deleteError } = await supabaseAdmin
    .from("matches")
    .delete()
    .eq("id", matchId)
    .eq("league_id", ownerCheck.league.id);

  if (deleteError) {
    console.error(deleteError);

    return NextResponse.json(
      { error: "Failed to delete match" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}