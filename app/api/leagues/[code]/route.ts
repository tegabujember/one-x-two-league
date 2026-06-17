import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateLeagueBody = {
  predictions_locked?: boolean;
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
    .select("id, owner_id, predictions_locked")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  if (league.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as UpdateLeagueBody;

  if (typeof body.predictions_locked !== "boolean") {
    return NextResponse.json(
      { error: "predictions_locked must be boolean" },
      { status: 400 }
    );
  }

  const { data: updatedLeague, error: updateError } = await supabaseAdmin
    .from("leagues")
    .update({
      predictions_locked: body.predictions_locked,
    })
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