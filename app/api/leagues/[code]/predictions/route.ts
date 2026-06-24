import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SavePredictionBody = {
  match_id?: string;
  player_id?: string;
  pick?: "1" | "X" | "2";
  stage_id?: string;
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
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as SavePredictionBody;

  const matchId = body.match_id?.trim();
  const playerId = body.player_id?.trim();
  const pick = body.pick;
  const requestedStageId = body.stage_id?.trim();

  if (!matchId || !playerId || !pick) {
    return NextResponse.json(
      { error: "Missing prediction fields" },
      { status: 400 }
    );
  }

  if (!["1", "X", "2"].includes(pick)) {
    return NextResponse.json({ error: "Invalid pick" }, { status: 400 });
  }

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("id, owner_id, active_stage_id")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const stageId = requestedStageId || league.active_stage_id;

  const { data: stage, error: stageError } = await supabaseAdmin
    .from("league_stages")
    .select("id, predictions_locked, admin_edit_mode")
    .eq("id", stageId)
    .eq("league_id", league.id)
    .single();

  if (stageError || !stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const isAdminOverride =
    stage.predictions_locked &&
    Boolean(stage.admin_edit_mode) &&
    league.owner_id === user.id;

  if (stage.id !== league.active_stage_id && !isAdminOverride) {
    return NextResponse.json(
      { error: "Predictions are only open for the active stage" },
      { status: 403 }
    );
  }

  if (stage.predictions_locked && !isAdminOverride) {
    return NextResponse.json(
      { error: "League predictions are locked" },
      { status: 403 }
    );
  }

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("id, league_id, user_id")
    .eq("id", playerId)
    .eq("league_id", league.id)
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (!isAdminOverride && player.user_id !== user.id) {
    return NextResponse.json(
      { error: "Player does not belong to this user" },
      { status: 403 }
    );
  }

  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select("id, league_id, stage_id, start_time")
    .eq("id", matchId)
    .eq("league_id", league.id)
    .eq("stage_id", stage.id)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (!isAdminOverride) {
    const now = new Date();
    const matchStartTime = new Date(match.start_time);

    if (matchStartTime <= now) {
      return NextResponse.json(
        { error: "Prediction is locked" },
        { status: 403 }
      );
    }
  }

  const { data: prediction, error: predictionError } = await supabaseAdmin
    .from("predictions")
    .upsert(
      {
        match_id: matchId,
        player_id: playerId,
        pick,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "match_id,player_id",
      }
    )
    .select()
    .single();

  if (predictionError || !prediction) {
    console.error(predictionError);

    return NextResponse.json(
      { error: "Failed to save prediction" },
      { status: 500 }
    );
  }

  return NextResponse.json({ prediction });
}
