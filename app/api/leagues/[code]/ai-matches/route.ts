import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

type AiMatchItem = {
  start_time: string;
  home_team: string;
  away_team: string;
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

function normalizeTeamName(value: string) {
  const aliases: Record<string, string> = {
    usa: "united states",
    "united states of america": "united states",
    "south korea": "south korea",
    "korea republic": "south korea",
    "republic of korea": "south korea",
    "czech republic": "czechia",
    türkiye: "turkey",
    turkey: "turkey",
    "ivory coast": "ivory coast",
    "cote d ivoire": "ivory coast",
    "côte d ivoire": "ivory coast",
    curacao: "curacao",
    curaçao: "curacao",
    "dr congo": "dr congo",
    "democratic republic of congo": "dr congo",
    "democratic republic of the congo": "dr congo",
  };

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[.'’()\-]/g, " ")
    .replace(/\s+/g, " ");

  return aliases[normalized] || normalized;
}

function isValidAiMatchItem(value: unknown): value is AiMatchItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.start_time !== "string" ||
    typeof item.home_team !== "string" ||
    typeof item.away_team !== "string"
  ) {
    return false;
  }

  if (!item.home_team.trim() || !item.away_team.trim()) {
    return false;
  }

  return !Number.isNaN(new Date(item.start_time).getTime());
}

function getMatchKey(match: AiMatchItem) {
  return [
    new Date(match.start_time).toISOString(),
    normalizeTeamName(match.home_team),
    normalizeTeamName(match.away_team),
  ].join("|");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const cleanCode = code.trim().toUpperCase();

  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    return NextResponse.json(
      { error: "Gemini API key is missing" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);

  const tournament =
    typeof body?.tournament === "string" ? body.tournament.trim() : "";

  const stage =
    typeof body?.stage === "string" ? body.stage.trim() : "";

  if (!tournament || !stage) {
    return NextResponse.json(
      { error: "Tournament and stage are required" },
      { status: 400 }
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
    .select("id, owner_id")
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

  const prompt = `
You are extracting official football fixtures from current web search results.

Tournament: ${tournament}
Stage: ${stage}

Your job:
1. Search for one official fixture source for this exact tournament and stage.
2. Use ONE source only for the entire response.
3. Extract matches only if they explicitly appear in that source.
4. Never complete missing fixtures from memory, logic, another source, or assumptions.
5. If you cannot find one official source containing the full selected stage, return an empty JSON array.

Strict rules:
- Return ONLY a valid JSON array.
- No markdown, explanations, comments, citations, source links, or extra text.
- Do not invent matches.
- Do not include scores.
- Do not include placeholder teams such as "TBD", "Winner", "Loser", "To Be Confirmed".
- Return dates in ISO 8601 UTC format.
- Use the exact home_team and away_team names shown in the official source.
- Every match must come from the same official source.
- If any fixture is uncertain, return [].
- Do not add matches that are not explicitly listed in the source.

Required JSON format:
[
  {
    "start_time": "2026-06-11T19:00:00Z",
    "home_team": "Mexico",
    "away_team": "South Africa"
  }
]
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
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
  const errorText = await geminiResponse.text();

  console.error("Gemini AI matches error:", errorText);

  return NextResponse.json(
    { error: "הגעת למגבלת השימוש של AI. נסה שוב בעוד כמה רגעים." },
    { status: 429 }
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
        matches: [],
        message: "לא נמצאו משחקים מאומתים לשלב הזה.",
      });
    }

    const validMatches = parsed
      .filter(isValidAiMatchItem)
      .filter(
        (match) =>
          !/tbd|to be confirmed|winner|loser|placeholder/i.test(
            `${match.home_team} ${match.away_team}`
          )
      );

    const uniqueMatches = Array.from(
      new Map(
        validMatches.map((match) => [getMatchKey(match), match])
      ).values()
    );

    return NextResponse.json({
      matches: uniqueMatches,
      message:
        uniqueMatches.length > 0
          ? `נמצאו ${uniqueMatches.length} משחקים ממקור מאומת.`
          : "לא נמצאו משחקים מאומתים לשלב הזה.",
    });
  } catch (error) {
    console.error("Unexpected AI matches error:", error);

    return NextResponse.json(
      { error: "Unexpected AI matches error" },
      { status: 500 }
    );
  }
}