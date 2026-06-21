import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateLeagueBody = {
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
    .select("id, owner_id, predictions_locked, admin_edit_mode")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  if (league.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as UpdateLeagueBody;

  const hasPredictionsLocked = typeof body.predictions_locked === "boolean";
  const hasAdminEditMode = typeof body.admin_edit_mode === "boolean";

  if (!hasPredictionsLocked && !hasAdminEditMode) {
    return NextResponse.json(
      { error: "Must provide predictions_locked and/or admin_edit_mode" },
      { status: 400 }
    );
  }

  const nextPredictionsLocked = hasPredictionsLocked
    ? body.predictions_locked!
    : league.predictions_locked;

  let nextAdminEditMode = hasAdminEditMode
    ? body.admin_edit_mode!
    : Boolean(league.admin_edit_mode);

  if (hasPredictionsLocked && body.predictions_locked === false) {
    nextAdminEditMode = false;
  }

  if (nextAdminEditMode && !nextPredictionsLocked) {
    return NextResponse.json(
      { error: "admin_edit_mode can only be true when predictions_locked is true" },
      { status: 400 }
    );
  }

  const updatePayload: {
    predictions_locked?: boolean;
    admin_edit_mode?: boolean;
  } = {};

  if (hasPredictionsLocked) {
    updatePayload.predictions_locked = body.predictions_locked;
  }

  if (
    hasAdminEditMode ||
    (hasPredictionsLocked && body.predictions_locked === false)
  ) {
    updatePayload.admin_edit_mode = nextAdminEditMode;
  }

  const { data: updatedLeague, error: updateError } = await supabaseAdmin
    .from("leagues")
    .update(updatePayload)
    .eq("id", league.id)
    .select()
    .single();

  if (updateError || !updatedLeague) {
    console.error(updateError);

    return NextResponse.json(
      { error: "Failed to update league" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    league: updatedLeague,
  });
}
