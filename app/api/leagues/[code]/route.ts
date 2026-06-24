import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateLeagueBody = {
  stage_id?: string;
  active_stage_id?: string;
  predictions_locked?: boolean;
  admin_edit_mode?: boolean;
};

export async function PATCH(
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
    .select(
      "id, owner_id, active_stage_id, predictions_locked, admin_edit_mode"
    )
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  if (league.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as UpdateLeagueBody;

  const requestedStageId = body.stage_id?.trim();
  const requestedActiveStageId = body.active_stage_id?.trim();
  const hasPredictionsLocked = typeof body.predictions_locked === "boolean";
  const hasAdminEditMode = typeof body.admin_edit_mode === "boolean";

  if (
    !requestedActiveStageId &&
    !hasPredictionsLocked &&
    !hasAdminEditMode
  ) {
    return NextResponse.json(
      {
        error:
          "Must provide active_stage_id, predictions_locked and/or admin_edit_mode",
      },
      { status: 400 }
    );
  }

  if (requestedActiveStageId && (hasPredictionsLocked || hasAdminEditMode)) {
    return NextResponse.json(
      { error: "Stage activation and stage settings must be updated separately" },
      { status: 400 }
    );
  }

  const targetStageId =
    requestedActiveStageId || requestedStageId || league.active_stage_id;

  const { data: targetStage, error: targetStageError } = await supabaseAdmin
    .from("league_stages")
    .select("*")
    .eq("id", targetStageId)
    .eq("league_id", league.id)
    .single();

  if (targetStageError || !targetStage) {
    console.error(targetStageError);

    return NextResponse.json(
      { error: "Stage not found" },
      { status: 404 }
    );
  }

  if (requestedActiveStageId) {
    const { data: updatedLeague, error: activationError } = await supabaseAdmin
      .from("leagues")
      .update({
        active_stage_id: targetStage.id,
        predictions_locked: targetStage.predictions_locked,
        admin_edit_mode: targetStage.admin_edit_mode,
      })
      .eq("id", league.id)
      .select()
      .single();

    if (activationError || !updatedLeague) {
      console.error(activationError);

      return NextResponse.json(
        { error: "Failed to activate stage" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      league: updatedLeague,
      stage: targetStage,
    });
  }

  const nextPredictionsLocked = hasPredictionsLocked
    ? body.predictions_locked!
    : targetStage.predictions_locked;

  let nextAdminEditMode = hasAdminEditMode
    ? body.admin_edit_mode!
    : Boolean(targetStage.admin_edit_mode);

  if (hasPredictionsLocked && body.predictions_locked === false) {
    nextAdminEditMode = false;
  }

  if (nextAdminEditMode && !nextPredictionsLocked) {
    return NextResponse.json(
      { error: "admin_edit_mode can only be true when predictions_locked is true" },
      { status: 400 }
    );
  }

  const updatePayload = {
    predictions_locked: nextPredictionsLocked,
    admin_edit_mode: nextAdminEditMode,
  };

  const { data: updatedStage, error: stageUpdateError } = await supabaseAdmin
    .from("league_stages")
    .update(updatePayload)
    .eq("id", targetStage.id)
    .eq("league_id", league.id)
    .select()
    .single();

  if (stageUpdateError || !updatedStage) {
    console.error(stageUpdateError);

    return NextResponse.json(
      { error: "Failed to update active stage" },
      { status: 500 }
    );
  }

  let updatedLeague = league;

  if (targetStage.id === league.active_stage_id) {
    const { data: mirroredLeague, error: updateError } = await supabaseAdmin
      .from("leagues")
      .update(updatePayload)
      .eq("id", league.id)
      .select()
      .single();

    if (updateError || !mirroredLeague) {
      console.error(updateError);

      return NextResponse.json(
        { error: "Failed to update league" },
        { status: 500 }
      );
    }

    updatedLeague = mirroredLeague;
  }

  return NextResponse.json({
    league: updatedLeague,
    stage: updatedStage,
  });
}
