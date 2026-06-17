import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateLeagueBody = {
  league_name?: string;
  admin_name?: string;
};

function generateLeagueCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  return code;
}

function generateAdminCode() {
  const numbers = "0123456789";
  let code = "";

  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return code;
}

async function createUniqueLeagueCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateLeagueCode();

    const { data } = await supabaseAdmin
      .from("leagues")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (!data) {
      return code;
    }
  }

  throw new Error("Failed to generate unique league code");
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as CreateLeagueBody;

  const leagueName = body.league_name?.trim();
  const adminName = body.admin_name?.trim();

  if (!leagueName || !adminName) {
    return NextResponse.json(
      { error: "Missing league name or admin name" },
      { status: 400 }
    );
  }

  const leagueCode = await createUniqueLeagueCode();
  const adminCode = generateAdminCode();

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .insert({
      name: leagueName,
      code: leagueCode,
      admin_name: adminName,
      admin_code: adminCode,
      owner_id: user.id,
    })
    .select()
    .single();

  if (leagueError || !league) {
    console.error(leagueError);

    return NextResponse.json(
      { error: "Failed to create league" },
      { status: 500 }
    );
  }

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .insert({
      league_id: league.id,
      name: adminName,
      user_id: user.id,
    })
    .select()
    .single();

  if (playerError || !player) {
    console.error(playerError);

    return NextResponse.json(
      { error: "League created but failed to create player" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      league,
      player,
      admin_code: adminCode,
    },
    { status: 201 }
  );
}