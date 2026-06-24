import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type MatchWithoutScore = {
  id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type AiResultItem = {
  match_id: string;
  home_score: number;
  away_score: number;
};

function extractJsonArray(text: string) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isValidAiResultItem(value: unknown): value is AiResultItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.match_id === "string" &&
    Number.isInteger(item.home_score) &&
    Number.isInteger(item.away_score) &&
    Number(item.home_score) >= 0 &&
    Number(item.away_score) >= 0
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const cleanCode = code.trim().toUpperCase();

  const body = await request.json().catch(() => null);
  const requestedStageId =
    typeof body?.stage_id === "string" ? body.stage_id.trim() : "";

  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    return NextResponse.json(
      { error: "Gemini API key is missing" },
      { status: 500 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("id, owner_id, active_stage_id")
    .eq("code", cleanCode)
    .single();

  if (leagueError || !league) {
    return NextResponse.json(
      { error: "League not found" },
      { status: 404 }
    );
  }

  if (league.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const stageId = requestedStageId || league.active_stage_id;

  const { data: stage, error: stageError } = await supabaseAdmin
    .from("league_stages")
    .select("id")
    .eq("id", stageId)
    .eq("league_id", league.id)
    .single();

  if (stageError || !stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  const { data: matches, error: matchesError } = await supabaseAdmin
    .from("matches")
    .select(
      "id, home_team, away_team, start_time, home_score, away_score, status"
    )
    .eq("league_id", league.id)
    .eq("stage_id", stage.id)
    .lte("start_time", now)
    .is("home_score", null)
    .is("away_score", null)
    .order("start_time", { ascending: true })
    .limit(30);

  if (matchesError) {
    console.error(matchesError);

    return NextResponse.json(
      { error: "Failed to load matches" },
      { status: 500 }
    );
  }

  const missingMatches = (matches || []) as MatchWithoutScore[];

  if (missingMatches.length === 0) {
    return NextResponse.json({
      results: [],
      foundCount: 0,
      missingCount: 0,
      message: "אין משחקים שעברו ועדיין חסרה להם תוצאה.",
    });
  }

  const matchesForAi = missingMatches.map((match) => ({
    match_id: match.id,
    home_team: match.home_team,
    away_team: match.away_team,
    start_time: new Date(match.start_time).toLocaleString("en-GB", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  }));

  const prompt = `
You are checking football match results using current web information.

Find final scores only for the matches below.

Rules:
- Return ONLY valid JSON array.
- Do not include markdown, explanations, comments, or citations.
- Use only matches with a confirmed final score.
- If a match is live, postponed, cancelled, unclear, or has no confirmed final score, omit it.
- Never invent a score.
- Keep match_id exactly as provided.
- Scores must be non-negative integers.

Required JSON format:
[
  {
    "match_id": "exact-match-id",
    "home_score": 2,
    "away_score": 1
  }
]

Matches:
${JSON.stringify(matchesForAi, null, 2)}
`;

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        geminiApiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          tools: [
            {
              google_search: {},
            },
          ],
          generationConfig: {
            temperature: 0,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();

      console.error("Gemini error:", errorText);

      return NextResponse.json(
        { error: "Failed to search match results with AI" },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();

    const aiText =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || "")
        .join("")
        .trim() || "";

    const parsed = extractJsonArray(aiText);

    if (!Array.isArray(parsed)) {
      return NextResponse.json({
        results: [],
        foundCount: 0,
        missingCount: missingMatches.length,
        message: "לא נמצאו תוצאות סופיות חדשות.",
      });
    }

    const allowedMatchIds = new Set(
      missingMatches.map((match) => match.id)
    );

    const validResults = parsed
      .filter(isValidAiResultItem)
      .filter((item) => allowedMatchIds.has(item.match_id));

    const uniqueResults = Array.from(
      new Map(validResults.map((item) => [item.match_id, item])).values()
    );

    const results = uniqueResults.map((result) => {
      const match = missingMatches.find(
        (currentMatch) => currentMatch.id === result.match_id
      )!;

      return {
        match_id: match.id,
        home_team: match.home_team,
        away_team: match.away_team,
        start_time: match.start_time,
        home_score: result.home_score,
        away_score: result.away_score,
      };
    });

    return NextResponse.json({
      results,
      foundCount: results.length,
      missingCount: missingMatches.length - results.length,
      message:
        results.length > 0
          ? `נמצאו ${results.length} תוצאות חדשות.`
          : "לא נמצאו תוצאות סופיות חדשות.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected AI results error" },
      { status: 500 }
    );
  }
}
