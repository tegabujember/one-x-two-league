// /one-x-two-league/app/league/[code]/admin/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";

type League = {
  id: string;
  name: string;
  code: string;
  admin_code: string | null;
  owner_id: string | null;
  predictions_locked: boolean;
  admin_edit_mode: boolean;
};

type Player = {
  id: string;
  league_id: string;
  name: string;
  user_id: string | null;
};

type Match = {
  id: string;
  league_id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type ImportedMatch = {
  home_team: string;
  away_team: string;
  start_time: string;
  home_score?: number;
  away_score?: number;
};

type ImportedPrediction = {
  home_team: string;
  away_team: string;
  start_time: string;
  pick: "1" | "X" | "2";
};

type ImportedResult = {
  home_team: string;
  away_team: string;
  start_time: string;
  home_score: number;
  away_score: number;
};

type ImportMode = "matches" | "results" | "predictions";

type ResultPreviewStatus =
  | "ready"
  | "hasScore"
  | "notFound"
  | "invalid"
  | "duplicate";

type ResultPreviewItem = {
  lineNumber: number;
  rawLine: string;
  status: ResultPreviewStatus;
  message: string;
  imported?: ImportedResult;
  matchId?: string;
  existingScore?: string;
};

type AiResultResponse = {
  results: Array<{
    match_id: string;
    home_team: string;
    away_team: string;
    start_time: string;
    home_score: number;
    away_score: number;
  }>;
  foundCount: number;
  missingCount: number;
  message: string;
};

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  message: string;
  type: ToastType;
};

function formatDateTimeForInput(dateString: string) {
  const date = new Date(dateString);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

function parseImportDate(dateText: string) {
  const match = dateText
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(`פורמט תאריך לא תקין: ${dateText}`);
  }

  const [, year, month, day, hour, minute] = match;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(`תאריך לא תקין: ${dateText}`);
  }

  return date.toISOString();
}

function parseMatchesImportText(text: string): ImportedMatch[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("לא הודבקו משחקים");
  }

  return lines.map((line, index) => {
    const parts = line.split("|").map((part) => part.trim());

    if (parts.length !== 3 && parts.length !== 4) {
      throw new Error(
        `שורה ${
          index + 1
        } לא תקינה. הפורמט צריך להיות: תאריך | בית | חוץ או תאריך | בית | חוץ | תוצאה`
      );
    }

    const [dateText, homeTeam, awayTeam, scoreText] = parts;

    if (!dateText || !homeTeam || !awayTeam) {
      throw new Error(`שורה ${index + 1} חסרה נתונים`);
    }

    const importedMatch: ImportedMatch = {
      home_team: homeTeam,
      away_team: awayTeam,
      start_time: parseImportDate(dateText),
    };

    if (scoreText !== undefined) {
      const scoreParts = scoreText.split("-").map((part) => part.trim());

      if (scoreParts.length !== 2) {
        throw new Error(
          `שורה ${index + 1} עם תוצאה לא תקינה. לדוגמה: 2-0`
        );
      }

      const homeScore = Number(scoreParts[0]);
      const awayScore = Number(scoreParts[1]);

      if (
        !Number.isInteger(homeScore) ||
        !Number.isInteger(awayScore) ||
        homeScore < 0 ||
        awayScore < 0
      ) {
        throw new Error(`שורה ${index + 1} עם תוצאה לא תקינה`);
      }

      importedMatch.home_score = homeScore;
      importedMatch.away_score = awayScore;
    }

    return importedMatch;
  });
}

function parsePredictionsImportText(text: string): ImportedPrediction[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("לא הודבקו ניחושים");
  }

  return lines.map((line, index) => {
    const parts = line.split("|").map((part) => part.trim());

    if (parts.length !== 4) {
      throw new Error(
        `שורה ${index + 1} לא תקינה. הפורמט צריך להיות: תאריך | בית | חוץ | סימון`
      );
    }

    const [dateText, homeTeam, awayTeam, pickText] = parts;
    const pick = pickText.toUpperCase();

    if (!dateText || !homeTeam || !awayTeam || !pick) {
      throw new Error(`שורה ${index + 1} חסרה נתונים`);
    }

    if (pick !== "1" && pick !== "X" && pick !== "2") {
      throw new Error(
        `שורה ${index + 1} עם סימון לא תקין. מותר רק 1 / X / 2`
      );
    }

    return {
      home_team: homeTeam,
      away_team: awayTeam,
      start_time: parseImportDate(dateText),
      pick,
    };
  });
}

function normalizeTeamName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isSameMatchMinute(firstDate: string, secondDate: string) {
  const firstTime = new Date(firstDate).getTime();
  const secondTime = new Date(secondDate).getTime();

  if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) {
    return false;
  }

  return Math.abs(firstTime - secondTime) < 60 * 1000;
}

function parseResultLine(line: string): ImportedResult {
  const parts = line.split("|").map((part) => part.trim());

  if (parts.length !== 4) {
    throw new Error("הפורמט צריך להיות: תאריך ושעה | בית | חוץ | תוצאה");
  }

  const [dateText, homeTeam, awayTeam, scoreText] = parts;

  if (!dateText || !homeTeam || !awayTeam || !scoreText) {
    throw new Error("השורה חסרה נתונים");
  }

  const scoreParts = scoreText.split("-").map((part) => part.trim());

  if (scoreParts.length !== 2) {
    throw new Error("תוצאה לא תקינה. לדוגמה: 2-1");
  }

  const homeScore = Number(scoreParts[0]);
  const awayScore = Number(scoreParts[1]);

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    throw new Error("תוצאה חייבת להיות מספרים חיוביים");
  }

  return {
    home_team: homeTeam,
    away_team: awayTeam,
    start_time: parseImportDate(dateText),
    home_score: homeScore,
    away_score: awayScore,
  };
}

export default function LeagueAdminPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const code = String(params.code).toUpperCase();

  const [league, setLeague] = useState<League | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [isAccountOwner, setIsAccountOwner] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [startTime, setStartTime] = useState("");

  const [importMode, setImportMode] = useState<ImportMode>("matches");
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [resultImportText, setResultImportText] = useState("");
  const [resultPreview, setResultPreview] = useState<ResultPreviewItem[]>([]);
  const [isCheckingResults, setIsCheckingResults] = useState(false);
  const [isUpdatingResults, setIsUpdatingResults] = useState(false);
  const [isCheckingAiResults, setIsCheckingAiResults] = useState(false);
  const [aiTournament, setAiTournament] = useState("מונדיאל 2026");
  const [aiStage, setAiStage] = useState("שלב בתים");
  const [customAiTournament, setCustomAiTournament] = useState("");
  const [matchImportMethod, setMatchImportMethod] = useState<"ai" | "manual">("ai");
  const [isCheckingAiMatches, setIsCheckingAiMatches] = useState(false);

  const [predictionPlayerId, setPredictionPlayerId] = useState("");
  const [predictionImportText, setPredictionImportText] = useState("");
  const [isImportingPredictions, setIsImportingPredictions] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [showAllAdminMatches, setShowAllAdminMatches] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  function getToastTypeFromMessage(message: string): ToastType {
    if (
      message.includes("בהצלחה") ||
      message.includes("עודכנה") ||
      message.includes("עודכנו") ||
      message.includes("נוסף") ||
      message.includes("נמחק") ||
      message.includes("יובאו") ||
      message.includes("נפתחו") ||
      message.includes("ננעלו") ||
      message.includes("הסתיימה") ||
      message.includes("הסתיים")
    ) {
      return "success";
    }

    if (
      message.includes("שגיאה") ||
      message.includes("אין לך") ||
      message.includes("לא נמצאה") ||
      message.includes("לא נטענה") ||
      message.includes("לא תקין")
    ) {
      return "error";
    }

    if (
      message.includes("צריך") ||
      message.includes("חייבת") ||
      message.includes("חסרה") ||
      message.includes("אין תוצאות")
    ) {
      return "warning";
    }

    return "info";
  }

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message?: unknown) => {
      const text = String(message ?? "");
      showToast(text, getToastTypeFromMessage(text));
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const loadLeagueAndMatches = useCallback(async () => {
    setIsLoadingPage(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: leagueData, error: leagueError } = await supabase
      .from("leagues")
      .select("*")
      .eq("code", code)
      .single();

    if (leagueError || !leagueData) {
      console.error(leagueError);
      alert("הליגה לא נמצאה");
      router.replace("/");
      return;
    }

    const savedAdminCode = localStorage.getItem(`league-admin-${code}`);

    const isAccountOwner =
      Boolean(user?.id) &&
      Boolean(leagueData.owner_id) &&
      user?.id === leagueData.owner_id;

    const isLegacyAdmin =
      Boolean(leagueData.admin_code) &&
      Boolean(savedAdminCode) &&
      savedAdminCode === leagueData.admin_code;

    if (!isAccountOwner && !isLegacyAdmin) {
      alert("אין לך הרשאת מנהל לליגה הזאת");
      router.replace(`/league/${code}`);
      return;
    }

    setIsAccountOwner(isAccountOwner);

    if (user?.email) {
      setAdminEmail(user.email);
    }

    setLeague({
      ...leagueData,
      admin_edit_mode: Boolean(leagueData.admin_edit_mode),
    });

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("league_id", leagueData.id)
      .order("created_at", { ascending: true });

    if (playersError) {
      console.error(playersError);
      alert("שגיאה בטעינת השחקנים");
      setIsLoadingPage(false);
      return;
    }

    setPlayers(playersData || []);

    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .eq("league_id", leagueData.id)
      .order("start_time", { ascending: true });

    if (matchesError) {
      console.error(matchesError);
      alert("שגיאה בטעינת המשחקים");
      setIsLoadingPage(false);
      return;
    }

    setMatches(matchesData || []);
    setIsLoadingPage(false);
  }, [code, router, supabase]);

  useEffect(() => {
    loadLeagueAndMatches();
  }, [loadLeagueAndMatches]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!league) {
      alert("הליגה לא נטענה");
      return;
    }

    if (!homeTeam.trim() || !awayTeam.trim() || !startTime.trim()) {
      alert("צריך למלא קבוצה ביתית, קבוצה אורחת ותאריך/שעה");
      return;
    }

    setIsLoading(true);

    const response = await fetch(`/api/leagues/${code}/matches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        home_team: homeTeam.trim(),
        away_team: awayTeam.trim(),
        start_time: new Date(startTime).toISOString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר למערכת כדי להוסיף משחק");
      } else if (response.status === 403) {
        alert("אין לך הרשאה להוסיף משחק לליגה הזאת");
      } else {
        alert("שגיאה בהוספת משחק");
      }

      setIsLoading(false);
      return;
    }

    setHomeTeam("");
    setAwayTeam("");
    setStartTime("");
    setIsLoading(false);

    await loadLeagueAndMatches();
    alert("המשחק נוסף בהצלחה");
  }

  async function importMatchesFromText() {
  if (!importText.trim()) {
    alert("צריך להדביק רשימת משחקים");
    return;
  }

  let parsedMatches: ImportedMatch[];

  try {
    parsedMatches = parseMatchesImportText(importText);
  } catch (error) {
    console.error(error);
    alert(error instanceof Error ? error.message : "שגיאה בקריאת הרשימה");
    return;
  }

  const normalizeText = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const normalizeDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.trim();
    }

    return date.toISOString().slice(0, 16);
  };

  const getMatchKey = (
    startTime: string,
    homeTeam: string,
    awayTeam: string
  ) =>
    [
      normalizeDate(startTime),
      normalizeText(homeTeam),
      normalizeText(awayTeam),
    ].join("|");

  const existingMatchKeys = new Set(
    matches.map((match) =>
      getMatchKey(match.start_time, match.home_team, match.away_team)
    )
  );

  const seenImportKeys = new Set<string>();

  const newMatches = parsedMatches.filter((match) => {
    const key = getMatchKey(
      match.start_time,
      match.home_team,
      match.away_team
    );

    if (existingMatchKeys.has(key)) {
      return false;
    }

    if (seenImportKeys.has(key)) {
      return false;
    }

    seenImportKeys.add(key);
    return true;
  });

  const skippedExisting = parsedMatches.length - newMatches.length;

  if (newMatches.length === 0) {
    alert(
      "לא נמצאו משחקים חדשים לייבוא. כל המשחקים כבר קיימים בליגה."
    );
    return;
  }

  const shouldImport = confirm(
    `נמצאו ${parsedMatches.length} משחקים ברשימה.\n\n` +
      `חדשים לייבוא: ${newMatches.length}\n` +
      `כבר קיימים / כפולים: ${skippedExisting}\n\n` +
      `לייבא רק את המשחקים החדשים?`
  );

  if (!shouldImport) {
    return;
  }

  setIsImporting(true);

  try {
    const response = await fetch(`/api/leagues/${code}/matches/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        matches: newMatches,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר למערכת כדי לייבא משחקים");
      } else if (response.status === 403) {
        alert("אין לך הרשאה לייבא משחקים לליגה הזאת");
      } else {
        alert("שגיאה בייבוא המשחקים");
      }

      return;
    }

    const data = await response.json();

    setImportText("");

    await loadLeagueAndMatches();

    alert(
      `יובאו ${data.imported} משחקים חדשים.\n` +
        `דולגו: ${skippedExisting}\n` +
        `הסתיימו: ${data.finished ?? 0}\n` +
        `עתידיים: ${data.upcoming ?? 0}`
    );
  } catch (error) {
    console.error(error);
    alert("שגיאה בלתי צפויה בייבוא המשחקים");
  } finally {
    setIsImporting(false);
  }
}

  // function previewResultsImport() {
  //   if (!resultImportText.trim()) {
  //     alert("צריך להדביק רשימת תוצאות");
  //     return;
  //   }
  function previewResultsImport(textToPreview = resultImportText) {
  if (!textToPreview.trim()) {
    alert("צריך להדביק רשימת תוצאות");
    return;
  }

  setIsCheckingResults(true);

  const lines = textToPreview
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const seenKeys = new Set<string>();

  const previewItems: ResultPreviewItem[] = lines.map((line, index) => {
    const lineNumber = index + 1;

    let imported: ImportedResult;

    try {
      imported = parseResultLine(line);
    } catch (error) {
      return {
        lineNumber,
        rawLine: line,
        status: "invalid",
        message: error instanceof Error ? error.message : "שורה לא תקינה",
      };
    }

    const duplicateKey = `${imported.start_time}|${normalizeTeamName(
      imported.home_team
    )}|${normalizeTeamName(imported.away_team)}`;

    if (seenKeys.has(duplicateKey)) {
      return {
        lineNumber,
        rawLine: line,
        status: "duplicate",
        message: "שורה כפולה באותה הדבקה",
        imported,
      };
    }

    seenKeys.add(duplicateKey);

    const existingMatch = matches.find(
      (match) =>
        normalizeTeamName(match.home_team) ===
          normalizeTeamName(imported.home_team) &&
        normalizeTeamName(match.away_team) ===
          normalizeTeamName(imported.away_team) &&
        isSameMatchMinute(match.start_time, imported.start_time)
    );

    if (!existingMatch) {
      return {
        lineNumber,
        rawLine: line,
        status: "notFound",
        message: "לא נמצא משחק קיים בליגה עם אותו תאריך, בית וחוץ",
        imported,
      };
    }

    if (
      existingMatch.home_score !== null ||
      existingMatch.away_score !== null
    ) {
      return {
        lineNumber,
        rawLine: line,
        status: "hasScore",
        message: "כבר קיימת תוצאה — לא יידרס",
        imported,
        matchId: existingMatch.id,
        existingScore: `${existingMatch.home_score ?? "-"}-${
          existingMatch.away_score ?? "-"
        }`,
      };
    }

    return {
      lineNumber,
      rawLine: line,
      status: "ready",
      message: "מוכן לעדכון",
      imported,
      matchId: existingMatch.id,
    };
  });

  setResultPreview(previewItems);
  setIsCheckingResults(false);

  const readyCount = previewItems.filter(
    (item) => item.status === "ready"
  ).length;

  alert(`הבדיקה הסתיימה. ${readyCount} תוצאות מוכנות לעדכון.`);
}

async function checkResultsWithAi() {
  setIsCheckingAiResults(true);

  try {
    const response = await fetch(`/api/leagues/${code}/ai-results`, {
      method: "POST",
    });

    const data = (await response.json().catch(() => null)) as
      | AiResultResponse
      | { error?: string }
      | null;

    if (!response.ok) {
      console.error(data);

      const errorMessage =
        data && "error" in data && typeof data.error === "string"
          ? data.error
          : "שגיאה בבדיקת תוצאות עם AI";

      alert(errorMessage);
      return;
    }

    const aiData = data as AiResultResponse;

    if (aiData.results.length === 0) {
      alert(aiData.message || "לא נמצאו תוצאות סופיות חדשות.");
      return;
    }

    const formattedResults = aiData.results
      .map((result) => {
        const date = new Date(result.start_time);

        const dateText = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jerusalem",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(date)
          .replace(",", "");

        return `${dateText} | ${result.home_team} | ${result.away_team} | ${result.home_score}-${result.away_score}`;
      })
      .join("\n");

    setResultImportText(formattedResults);
    setResultPreview([]);

    previewResultsImport(formattedResults);

    const extraMessage =
      aiData.missingCount > 0
        ? ` ${aiData.missingCount} משחקים עדיין ללא תוצאה סופית.`
        : "";

    alert(`נמצאו ${aiData.foundCount} תוצאות חדשות. בדוק ואשר.${extraMessage}`);
  } catch (error) {
    console.error(error);
    alert("שגיאה בבדיקת תוצאות עם AI");
  } finally {
    setIsCheckingAiResults(false);
  }
}

async function checkMatchesWithAi() {
  const tournament =
    aiTournament === "טורניר אחר"
      ? customAiTournament.trim()
      : aiTournament;

  if (!tournament) {
    alert("צריך לכתוב שם לטורניר");
    return;
  }

  setIsCheckingAiMatches(true);

  try {
    const response = await fetch(`/api/leagues/${code}/ai-matches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tournament,
        stage: aiStage,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          matches?: Array<{
            start_time: string;
            home_team: string;
            away_team: string;
          }>;
          message?: string;
          error?: string;
        }
      | null;

    if (!response.ok) {
      console.error(data);

      alert(
        data && typeof data.error === "string"
          ? data.error
          : "שגיאה בבדיקת משחקים עם AI"
      );
      return;
    }

    const aiMatches = data?.matches || [];

    if (aiMatches.length === 0) {
      alert(data?.message || "לא נמצאו משחקים חדשים לשלב הזה.");
      return;
    }

    const formattedMatches = aiMatches
      .map((match) => {
        const date = new Date(match.start_time);

        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Jerusalem",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(date);

        const values = Object.fromEntries(
          parts
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value])
        );

        const dateText =
          `${values.year}-${values.month}-${values.day} ` +
          `${values.hour}:${values.minute}`;

        return `${dateText} | ${match.home_team} | ${match.away_team}`;
      })
      .join("\n");

    setImportText(formattedMatches);
    setMatchImportMethod("manual");

    alert(
      `נמצאו ${aiMatches.length} משחקים. בדוק את הרשימה ולחץ "ייבא משחקים".`
    );
  } catch (error) {
    console.error(error);
    alert("שגיאה בלתי צפויה בבדיקת משחקים עם AI");
  } finally {
    setIsCheckingAiMatches(false);
  }
}

  async function importCheckedResults() {
    const readyItems = resultPreview.filter(
      (item) => item.status === "ready" && item.imported && item.matchId
    );

    if (readyItems.length === 0) {
      alert("אין תוצאות מוכנות לעדכון");
      return;
    }

    const shouldUpdate = confirm(
      `לעדכן ${readyItems.length} תוצאות? משחקים שכבר יש להם תוצאה לא יידרסו.`
    );

    if (!shouldUpdate) {
      return;
    }

    setIsUpdatingResults(true);

    let updated = 0;
    let skippedExisting = 0;
    let failed = 0;

    for (const item of readyItems) {
      if (!item.imported || !item.matchId) {
        failed += 1;
        continue;
      }

      const currentMatch = matches.find((match) => match.id === item.matchId);

      if (
        !currentMatch ||
        currentMatch.home_score !== null ||
        currentMatch.away_score !== null
      ) {
        skippedExisting += 1;
        continue;
      }

      const response = await fetch(
        `/api/leagues/${code}/matches/${item.matchId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
          home_score: item.imported.home_score,
          away_score: item.imported.away_score,
          only_if_no_score: true,
        }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(errorData);
        failed += 1;
        continue;
      }

      updated += 1;
    }

    setIsUpdatingResults(false);

    await loadLeagueAndMatches();

    if (updated > 0) {
      setResultImportText("");
      setResultPreview([]);
    }

    alert(
      `עדכון תוצאות הסתיים.\nעודכנו: ${updated}\nדולגו כי כבר יש תוצאה: ${skippedExisting}\nשגיאות: ${failed}`
    );
  }

  async function importPredictionsFromText() {
    if (!predictionPlayerId) {
      alert("צריך לבחור שחקן");
      return;
    }

    if (!predictionImportText.trim()) {
      alert("צריך להדביק רשימת ניחושים");
      return;
    }

    let parsedPredictions: ImportedPrediction[];

    try {
      parsedPredictions = parsePredictionsImportText(predictionImportText);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "שגיאה בקריאת הניחושים");
      return;
    }

    const selectedPlayer = players.find(
      (player) => player.id === predictionPlayerId
    );

    const shouldImport = confirm(
      `נמצאו ${parsedPredictions.length} ניחושים${
        selectedPlayer ? ` עבור ${selectedPlayer.name}` : ""
      }. לייבא אותם?`
    );

    if (!shouldImport) {
      return;
    }

    setIsImportingPredictions(true);

    const response = await fetch(`/api/leagues/${code}/predictions/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player_id: predictionPlayerId,
        predictions: parsedPredictions,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר למערכת כדי לייבא ניחושים");
      } else if (response.status === 403) {
        alert("אין לך הרשאה לייבא ניחושים לליגה הזאת");
      } else if (response.status === 400) {
        alert(
          "חלק מהניחושים לא תואמים משחקים קיימים או שיש שגיאה בפורמט. בדוק את הקונסול."
        );
      } else {
        alert("שגיאה בייבוא הניחושים");
      }

      setIsImportingPredictions(false);
      return;
    }

    const data = await response.json();

    setPredictionImportText("");
    setPredictionPlayerId("");
    setIsImportingPredictions(false);

    alert(
      `יובאו ${data.imported} ניחושים.\nדולגו קיימים: ${
        data.skippedExisting ?? 0
      }\nדולגו משחקים נעולים: ${data.skippedLocked ?? 0}`
    );
  }

  function clearAppLocalStorage() {
    localStorage.removeItem("last-league-code");
    localStorage.removeItem("redirect-after-login");

    Object.keys(localStorage)
      .filter(
        (key) =>
          key.startsWith("selected-player-") || key.startsWith("league-admin-")
      )
      .forEach((key) => localStorage.removeItem(key));
  }

  async function signOut() {
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      alert("שגיאה בהתנתקות");
      setIsSigningOut(false);
      return;
    }

    clearAppLocalStorage();

    setAdminEmail("");
    setIsAccountMenuOpen(false);
    setIsSigningOut(false);

    window.location.href = "/";
  }

  const now = new Date();

  const matchesWithoutScore = matches.filter(
    (match) => match.home_score === null || match.away_score === null
  );

  const pastMatchesWithoutScore = matchesWithoutScore.filter(
    (match) => new Date(match.start_time) <= now
  );

  const upcomingMatchesWithoutScore = matchesWithoutScore.filter(
    (match) => new Date(match.start_time) > now
  );

  const priorityMatchesWithoutScore =
    pastMatchesWithoutScore.length > 0
      ? pastMatchesWithoutScore
      : upcomingMatchesWithoutScore;

  const adminMatchesToShow = showAllAdminMatches
    ? matches
    : priorityMatchesWithoutScore.slice(0, 4);

  async function toggleLeaguePredictionsLock() {
    if (!league) {
      alert("הליגה לא נטענה");
      return;
    }

    const nextLockedValue = !league.predictions_locked;

    const message = nextLockedValue
      ? "אתה בטוח שאתה רוצה לנעול ניחושים לכל הליגה?"
      : "אתה בטוח שאתה רוצה לפתוח מחדש ניחושים למשחקים עתידיים?";

    const shouldUpdate = confirm(message);

    if (!shouldUpdate) {
      return;
    }

    const response = await fetch(`/api/leagues/${code}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        predictions_locked: nextLockedValue,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר למערכת");
      } else if (response.status === 403) {
        alert("אין לך הרשאה לשנות את מצב הניחושים");
      } else {
        alert("שגיאה בעדכון מצב הניחושים");
      }

      return;
    }

    await loadLeagueAndMatches();

    alert(
      nextLockedValue
        ? "הניחושים ננעלו לכולם"
        : "הניחושים נפתחו למשחקים עתידיים"
    );
  }

  async function toggleAdminEditMode() {
    if (!league) {
      alert("הליגה לא נטענה");
      return;
    }

    if (!league.predictions_locked) {
      alert("מצב עריכת מנהל זמין רק כשהניחושים נעולים");
      return;
    }

    const nextAdminEditMode = !league.admin_edit_mode;

    const message = nextAdminEditMode
      ? "הפעלת מצב עריכת מנהל תאפשר לך לערוך ניחושים עבור כל שחקן בליגה, כולל משחקים שכבר התחילו. להמשיך?"
      : "לבטל מצב עריכת מנהל? לא תוכל יותר לערוך ניחושים של שחקנים אחרים.";

    const shouldUpdate = confirm(message);

    if (!shouldUpdate) {
      return;
    }

    const response = await fetch(`/api/leagues/${code}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admin_edit_mode: nextAdminEditMode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר למערכת");
      } else if (response.status === 403) {
        alert("אין לך הרשאה לשנות את מצב עריכת המנהל");
      } else {
        alert("שגיאה בעדכון מצב עריכת המנהל");
      }

      return;
    }

    await loadLeagueAndMatches();

    alert(
      nextAdminEditMode
        ? "מצב עריכת מנהל הופעל"
        : "מצב עריכת מנהל בוטל"
    );
  }

  async function updateScore(
    matchId: string,
    homeScore: string,
    awayScore: string
  ) {
    if (homeScore === "" || awayScore === "") {
      alert("צריך למלא שתי תוצאות");
      return;
    }

    const homeScoreNumber = Number(homeScore);
    const awayScoreNumber = Number(awayScore);

    if (
      Number.isNaN(homeScoreNumber) ||
      Number.isNaN(awayScoreNumber) ||
      homeScoreNumber < 0 ||
      awayScoreNumber < 0
    ) {
      alert("תוצאה חייבת להיות מספר חיובי");
      return;
    }

    const response = await fetch(`/api/leagues/${code}/matches/${matchId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        home_score: homeScoreNumber,
        away_score: awayScoreNumber,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר למערכת כדי לעדכן תוצאה");
      } else if (response.status === 403) {
        alert("אין לך הרשאה לעדכן תוצאה בליגה הזאת");
      } else {
        alert("שגיאה בעדכון התוצאה");
      }

      return;
    }

    await loadLeagueAndMatches();
    alert("התוצאה עודכנה בהצלחה");
  }

  async function updateMatchDetails(
    matchId: string,
    homeTeamValue: string,
    awayTeamValue: string,
    startTimeValue: string
  ) {
    if (
      !homeTeamValue.trim() ||
      !awayTeamValue.trim() ||
      !startTimeValue.trim()
    ) {
      alert("צריך למלא קבוצה ביתית, קבוצה אורחת ותאריך/שעה");
      return;
    }

    const response = await fetch(`/api/leagues/${code}/matches/${matchId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        home_team: homeTeamValue.trim(),
        away_team: awayTeamValue.trim(),
        start_time: new Date(startTimeValue).toISOString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר למערכת כדי לערוך משחק");
      } else if (response.status === 403) {
        alert("אין לך הרשאה לערוך משחק בליגה הזאת");
      } else {
        alert("שגיאה בעדכון המשחק");
      }

      return;
    }

    await loadLeagueAndMatches();
    alert("המשחק עודכן בהצלחה");
  }

  async function deleteMatch(matchId: string) {
    const shouldDelete = confirm(
      "אתה בטוח שאתה רוצה למחוק את המשחק? כל הניחושים של המשחק הזה יימחקו גם."
    );

    if (!shouldDelete) {
      return;
    }

    const response = await fetch(`/api/leagues/${code}/matches/${matchId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר למערכת כדי למחוק משחק");
      } else if (response.status === 403) {
        alert("אין לך הרשאה למחוק משחק בליגה הזאת");
      } else {
        alert("שגיאה במחיקת המשחק");
      }

      return;
    }

    await loadLeagueAndMatches();
    alert("המשחק נמחק בהצלחה");
  }

  if (isLoadingPage) {
    return (
      <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />

        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-3xl">🏆</span>
          </div>

          <p className="text-slate-300 font-semibold">טוען ניהול ליגה...</p>
        </div>
      </main>
    );
  }

  const importModeTitle =
    importMode === "matches"
      ? "ייבוא משחקים חדשים"
      : importMode === "results"
        ? "עדכון תוצאות למשחקים קיימים"
        : "ייבוא ניחושים לשחקן";

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative px-3 py-5 sm:px-4 sm:py-8">
      {toast && (
        <div className="fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
          <div
            className={`rounded-2xl border px-4 py-3 text-center text-sm font-bold shadow-2xl backdrop-blur-xl ${
              toast.type === "success"
                ? "border-green-400/30 bg-green-500/20 text-green-100"
                : toast.type === "error"
                  ? "border-red-400/30 bg-red-500/20 text-red-100"
                  : toast.type === "warning"
                    ? "border-yellow-400/30 bg-yellow-500/20 text-yellow-100"
                    : "border-blue-400/30 bg-blue-500/20 text-blue-100"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {adminEmail && (
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <button
            type="button"
            title="החשבון שלי"
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 text-xl shadow-lg shadow-black/30 backdrop-blur transition hover:scale-105 hover:bg-slate-800"
          >
            👤
          </button>

          {isAccountMenuOpen && (
            <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-right shadow-2xl shadow-black/40 backdrop-blur">
              <p className="mb-1 text-xs text-slate-400">מחובר בתור</p>

              <p className="mb-4 break-all text-sm font-bold text-green-300">
                {adminEmail}
              </p>

              <button
                type="button"
                onClick={signOut}
                disabled={isSigningOut}
                className="w-full rounded-xl bg-gradient-to-r from-red-500 to-rose-700 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSigningOut ? "מתנתק..." : "התנתק"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.20),_transparent_32%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.18),_transparent_34%)]" />
      <div className="absolute top-10 left-8 h-20 w-20 rounded-full bg-green-500/20 blur-3xl" />
      <div className="absolute bottom-10 right-8 h-24 w-24 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-3xl">
        <div className="mb-4 text-center sm:mb-6">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30 sm:h-16 sm:w-16">
            <span className="text-2xl sm:text-3xl">🛠️</span>
          </div>

          <p className="text-[10px] font-semibold tracking-[0.28em] text-green-300 sm:text-xs sm:tracking-[0.35em]">
            ADMIN PANEL
          </p>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
          <div className="text-center">
            <p className="mb-1 text-xs text-slate-400 sm:text-sm">
              ניהול ליגה
            </p>

            <h1 className="text-2xl font-black tracking-tight sm:text-4xl">
              הוספת משחקים
            </h1>

            {league && (
              <div className="mt-4 inline-flex flex-col items-center rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 sm:mt-5 sm:rounded-2xl sm:px-5 sm:py-3">
                <span className="text-base font-bold sm:text-lg">
                  {league.name}
                </span>

                <span className="mt-1 text-xs text-slate-400 sm:text-sm">
                  קוד ליגה: {" "}
                  <span className="font-black tracking-widest text-green-300">
                    {league.code}
                  </span>
                </span>

                {adminEmail && (
                  <span className="mt-2 rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1 text-[11px] font-bold text-green-300">
                    מנהל מחובר: {adminEmail}
                  </span>
                )}

                <div className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                  <p className="mb-3 text-xs font-bold text-slate-300">
                    מצב ניחושים: {" "}
                    <span
                      className={
                        league.predictions_locked
                          ? "text-red-300"
                          : "text-green-300"
                      }
                    >
                      {league.predictions_locked ? "נעולים" : "פתוחים"}
                    </span>
                  </p>

                  <button
                    type="button"
                    onClick={toggleLeaguePredictionsLock}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-black transition hover:scale-[1.02] ${
                      league.predictions_locked
                        ? "bg-gradient-to-r from-green-500 to-emerald-700 text-white"
                        : "bg-gradient-to-r from-red-500 to-rose-700 text-white"
                    }`}
                  >
                    {league.predictions_locked
                      ? "פתח ניחושים למשחקים עתידיים"
                      : "נעל ניחושים לכל הליגה"}
                  </button>

                  {league.predictions_locked && isAccountOwner && (
                    <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                      <p className="mb-2 text-xs font-bold text-amber-200">
                        מצב עריכת מנהל:{" "}
                        <span
                          className={
                            league.admin_edit_mode
                              ? "text-amber-100"
                              : "text-slate-300"
                          }
                        >
                          {league.admin_edit_mode ? "פעיל" : "כבוי"}
                        </span>
                      </p>

                      <p className="mb-3 text-[11px] leading-5 text-amber-100/80">
                        כשמופעל, תוכל לערוך ניחושים עבור כל שחקן בליגה — גם
                        אחרי שהמשחק התחיל. שחקנים רגילים יישארו חסומים.
                      </p>

                      <button
                        type="button"
                        onClick={toggleAdminEditMode}
                        className={`w-full rounded-xl px-4 py-3 text-sm font-black transition hover:scale-[1.02] ${
                          league.admin_edit_mode
                            ? "bg-gradient-to-r from-slate-600 to-slate-800 text-white"
                            : "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        }`}
                      >
                        {league.admin_edit_mode
                          ? "בטל מצב עריכת מנהל"
                          : "הפעל מצב עריכת מנהל"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300 sm:text-sm">
                  קבוצה ביתית
                </label>

                <input
                  type="text"
                  value={homeTeam}
                  onChange={(event) => setHomeTeam(event.target.value)}
                  placeholder="בית"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-center text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-green-400 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base"
                />
              </div>

              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-400/10 text-xs font-black text-yellow-300 sm:mb-2 sm:h-12 sm:w-12">
                נגד
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300 sm:text-sm">
                  קבוצה אורחת
                </label>

                <input
                  type="text"
                  value={awayTeam}
                  onChange={(event) => setAwayTeam(event.target.value)}
                  placeholder="חוץ"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-center text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-green-400 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-300 sm:text-sm">
                תאריך ושעה
              </label>

              <input
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none transition focus:border-green-400 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-700 px-4 py-3 text-sm font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
            >
              {isLoading ? "מוסיף משחק..." : "הוסף משחק"}
            </button>
          </form>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-black sm:text-2xl">ייבוא נתונים</h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              בחר סוג ייבוא, הדבק רשימה בפורמט הקבוע, והמערכת תבצע רק את הפעולה
              שבחרת.
            </p>
          </div>

          <label className="mb-2 block text-xs font-semibold text-slate-300 sm:text-sm">
            סוג ייבוא
          </label>

          <select
            value={importMode}
            onChange={(event) => {
              setImportMode(event.target.value as ImportMode);
              setResultPreview([]);
            }}
            className="mb-4 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold outline-none focus:border-green-400 sm:rounded-2xl sm:py-4 sm:text-base"
          >
            <option value="matches">ייבוא משחקים חדשים</option>
            <option value="results">עדכון תוצאות למשחקים קיימים</option>
            <option value="predictions">ייבוא ניחושים לשחקן</option>
          </select>

          <div className="mb-4 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-xs leading-6 text-yellow-100">
            <p className="mb-1 font-bold">{importModeTitle}</p>

            {importMode === "matches" && (
              <>
                <p>2026-06-11 22:00 | Mexico | South Africa</p>
                <p>2026-06-12 05:00 | South Korea | Czechia | 2-1</p>
              </>
            )}

            {importMode === "results" && (
              <>
                <p>2026-06-18 19:00 | Czechia | South Africa | 1-1</p>
                <p>2026-06-18 22:00 | Switzerland | Bosnia and Herzegovina | 4-1</p>
                <p className="mt-2 text-yellow-200">
                  עדכון תוצאות לא מוסיף משחקים ולא דורס תוצאה קיימת.
                </p>
              </>
            )}

            {importMode === "predictions" && (
              <>
                <p>2026-06-11 22:00 | Mexico | South Africa | 1</p>
                <p>2026-06-12 19:00 | Argentina | Spain | X</p>
                <p>2026-06-12 22:00 | France | Germany | 2</p>
              </>
            )}
          </div>

          {importMode === "matches" && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/70 p-2">
                <button
                  type="button"
                  onClick={() => setMatchImportMethod("ai")}
                  className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                    matchImportMethod === "ai"
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-700 text-white shadow-lg shadow-violet-950/40"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  ✨ ייבוא עם AI
                </button>

                <button
                  type="button"
                  onClick={() => setMatchImportMethod("manual")}
                  className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                    matchImportMethod === "manual"
                      ? "bg-gradient-to-r from-blue-500 to-indigo-700 text-white shadow-lg shadow-blue-950/40"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  ✍️ הדבקה ידנית
                </button>
              </div>

              {matchImportMethod === "ai" && (
                <div className="mb-5 rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-black text-white sm:text-lg">
                      ייבוא משחקים עם AI
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      בחר טורניר ושלב, והמערכת תביא את כל משחקי השלב ל־Preview לפני אישור.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-200">
                        טורניר
                      </span>

                      <select
                        value={aiTournament}
                        onChange={(event) => setAiTournament(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-violet-400"
                      >
                        <option value="מונדיאל 2026">מונדיאל 2026</option>
                        <option value="ליגת האלופות 2026/27">
                          ליגת האלופות 2026/27
                        </option>
                        <option value="פרמייר ליג 2026/27">
                          פרמייר ליג 2026/27
                        </option>
                        <option value="לה ליגה 2026/27">לה ליגה 2026/27</option>
                        <option value="טורניר אחר">טורניר אחר</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-200">
                        שלב
                      </span>

                      <select
                        value={aiStage}
                        onChange={(event) => setAiStage(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-violet-400"
                      >
                        <option value="שלב בתים">שלב בתים</option>
                        <option value="שלב 32 האחרונות">שלב 32 האחרונות</option>
                        <option value="שמינית גמר">שמינית גמר</option>
                        <option value="רבע גמר">רבע גמר</option>
                        <option value="חצי גמר">חצי גמר</option>
                        <option value="משחק על מקום שלישי">
                          משחק על מקום שלישי
                        </option>
                        <option value="גמר">גמר</option>
                      </select>
                    </label>
                  </div>

                  {aiTournament === "טורניר אחר" && (
                    <div className="mt-3">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-200">
                          שם הטורניר
                        </span>

                        <input
                          type="text"
                          value={customAiTournament}
                          onChange={(event) => setCustomAiTournament(event.target.value)}
                          placeholder="לדוגמה: גביע אפריקה 2027"
                          className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400"
                        />
                      </label>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={checkMatchesWithAi}
                    disabled={
                      isCheckingAiMatches ||
                      (aiTournament === "טורניר אחר" && !customAiTournament.trim())
                    }
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02] hover:from-violet-400 hover:to-fuchsia-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                  >
                    {isCheckingAiMatches
                      ? "AI מחפש משחקים..."
                      : "✨ הבא את כל משחקי השלב עם AI"}
                  </button>
                </div>
              )}

              {matchImportMethod === "manual" && (
                <>
                  <textarea
                    value={importText}
                    onChange={(event) => setImportText(event.target.value)}
                    placeholder={`2026-06-11 22:00 | Mexico | South Africa
              2026-06-12 05:00 | South Korea | Czechia | 2-1
              2026-06-17 20:00 | Portugal | DR Congo`}
                    rows={8}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-green-400"
                  />

                  <button
                    type="button"
                    onClick={importMatchesFromText}
                    disabled={isImporting || !importText.trim()}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-700 px-4 py-3 text-sm font-bold shadow-lg shadow-purple-950/40 transition hover:scale-[1.02] hover:from-purple-400 hover:to-fuchsia-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                  >
                    {isImporting ? "מייבא משחקים..." : "ייבא משחקים"}
                  </button>
                </>
              )}
            </>
          )}

          {importMode === "results" && (
            <>
              <textarea
                value={resultImportText}
                onChange={(event) => {
                  setResultImportText(event.target.value);
                  setResultPreview([]);
                }}
                placeholder={`2026-06-18 19:00 | Czechia | South Africa | 1-1
2026-06-18 22:00 | Switzerland | Bosnia and Herzegovina | 4-1
2026-06-19 01:00 | Canada | Qatar | 6-0`}
                rows={8}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-green-400"
              />

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={checkResultsWithAi}
                  disabled={
                    isCheckingAiResults ||
                    isCheckingResults ||
                    isUpdatingResults
                  }
                  className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-700 px-4 py-3 text-sm font-bold shadow-lg shadow-purple-950/40 transition hover:scale-[1.02] hover:from-violet-400 hover:to-purple-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                >
                  {isCheckingAiResults ? "מחפש תוצאות..." : "✨ בדוק תוצאות עם AI"}
                </button>
                <button
                  type="button"
                  onClick={() => previewResultsImport()}
                  disabled={
                    isCheckingResults ||
                    isUpdatingResults ||
                    !resultImportText.trim()
                  }
                  className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-700 px-4 py-3 text-sm font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                >
                  {isCheckingResults ? "בודק תוצאות..." : "בדוק תוצאות"}
                </button>
                <button
                  type="button"
                  onClick={importCheckedResults}
                  disabled={
                    isUpdatingResults ||
                    resultPreview.filter((item) => item.status === "ready")
                      .length === 0
                  }
                  className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-4 py-3 text-sm font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                >
                  {isUpdatingResults
                    ? "מעדכן תוצאות..."
                    : "אשר ועדכן תוצאות חדשות"}
                </button>
              </div>

              {resultPreview.length > 0 && (
                <div className="mt-5 space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-green-400/20 bg-green-500/10 p-3 text-center">
                      <p className="text-xl font-black text-green-300">
                        {
                          resultPreview.filter(
                            (item) => item.status === "ready"
                          ).length
                        }
                      </p>
                      <p className="text-xs text-slate-400">מוכנים</p>
                    </div>

                    <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-center">
                      <p className="text-xl font-black text-yellow-300">
                        {
                          resultPreview.filter(
                            (item) => item.status === "hasScore"
                          ).length
                        }
                      </p>
                      <p className="text-xs text-slate-400">כבר יש תוצאה</p>
                    </div>

                    <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-center">
                      <p className="text-xl font-black text-red-300">
                        {
                          resultPreview.filter(
                            (item) =>
                              item.status === "notFound" ||
                              item.status === "invalid"
                          ).length
                        }
                      </p>
                      <p className="text-xs text-slate-400">שגיאות</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-center">
                      <p className="text-xl font-black text-slate-200">
                        {
                          resultPreview.filter(
                            (item) => item.status === "duplicate"
                          ).length
                        }
                      </p>
                      <p className="text-xs text-slate-400">כפולים</p>
                    </div>
                  </div>

                  {resultPreview.map((item) => (
                    <div
                      key={`${item.lineNumber}-${item.rawLine}`}
                      className={`rounded-xl border p-3 text-sm ${
                        item.status === "ready"
                          ? "border-green-400/20 bg-green-500/10 text-green-100"
                          : item.status === "hasScore"
                            ? "border-yellow-400/20 bg-yellow-500/10 text-yellow-100"
                            : "border-red-400/20 bg-red-500/10 text-red-100"
                      }`}
                    >
                      <p className="font-bold">
                        שורה {item.lineNumber}: {item.message}
                      </p>

                      <p className="mt-1 break-words text-xs opacity-80">
                        {item.rawLine}
                      </p>

                      {item.existingScore && (
                        <p className="mt-1 text-xs">
                          תוצאה קיימת במערכת: {item.existingScore}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {importMode === "predictions" && (
            <>
              <label className="mb-2 block text-xs font-semibold text-slate-300 sm:text-sm">
                בחר שחקן
              </label>

              <select
                value={predictionPlayerId}
                onChange={(event) => setPredictionPlayerId(event.target.value)}
                className="mb-4 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-green-400 sm:rounded-2xl sm:py-4 sm:text-base"
              >
                <option value="">בחר שחקן</option>

                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>

              <textarea
                value={predictionImportText}
                onChange={(event) => setPredictionImportText(event.target.value)}
                placeholder={`2026-06-11 22:00 | Mexico | South Africa | 1
2026-06-12 19:00 | Argentina | Spain | X
2026-06-12 22:00 | France | Germany | 2`}
                rows={8}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-green-400"
              />

              <button
                type="button"
                onClick={importPredictionsFromText}
                disabled={
                  isImportingPredictions ||
                  !predictionImportText.trim() ||
                  !predictionPlayerId
                }
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-700 px-4 py-3 text-sm font-bold shadow-lg shadow-red-950/40 transition hover:scale-[1.02] hover:from-orange-400 hover:to-red-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
              >
                {isImportingPredictions
                  ? "מייבא ניחושים..."
                  : "ייבא ניחושים לשחקן"}
              </button>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
            <div>
              <h2 className="text-xl font-black sm:text-2xl">ניהול משחקים</h2>

              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                {showAllAdminMatches
                  ? "מציג את כל המשחקים בליגה"
                  : pastMatchesWithoutScore.length > 0
                    ? "מציג משחקים שעברו ועדיין אין להם תוצאה"
                    : "אין משחקים שעברו ללא תוצאה — מציג את הקרובים ביותר ללא תוצאה"}
              </p>
            </div>

            <span className="shrink-0 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-400 sm:px-4 sm:py-2 sm:text-xs">
              {showAllAdminMatches
                ? `${matches.length} משחקים`
                : pastMatchesWithoutScore.length > 0
                  ? `${pastMatchesWithoutScore.length} עברו ללא תוצאה`
                  : `${upcomingMatchesWithoutScore.length} קרובים ללא תוצאה`}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowAllAdminMatches(false)}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition sm:rounded-2xl ${
                !showAllAdminMatches
                  ? "bg-gradient-to-r from-green-500 to-emerald-700 text-white shadow-lg shadow-green-950/40"
                  : "border border-white/10 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
              }`}
            >
              משחקים שצריכים עדכון
            </button>

            <button
              type="button"
              onClick={() => setShowAllAdminMatches(true)}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition sm:rounded-2xl ${
                showAllAdminMatches
                  ? "bg-gradient-to-r from-blue-500 to-indigo-700 text-white shadow-lg shadow-blue-950/40"
                  : "border border-white/10 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
              }`}
            >
              כל המשחקים
            </button>
          </div>

          {matches.length === 0 ? (
            <p className="text-sm text-slate-400">עדיין אין משחקים לעדכן.</p>
          ) : !showAllAdminMatches && priorityMatchesWithoutScore.length === 0 ? (
            <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-5 text-center">
              <p className="text-2xl">✅</p>
              <p className="mt-2 text-sm font-bold text-green-300">
                אין כרגע משחקים שממתינים לעדכון תוצאה
              </p>
              <p className="mt-1 text-xs text-slate-400">
                אפשר ללחוץ על “כל המשחקים” כדי לערוך משחקים עתידיים או קיימים.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 sm:space-y-4">
                {adminMatchesToShow.map((match) => (
                  <MatchAdminCard
                    key={match.id}
                    match={match}
                    onUpdateScore={updateScore}
                    onUpdateMatch={updateMatchDetails}
                    onDeleteMatch={deleteMatch}
                  />
                ))}
              </div>

              {!showAllAdminMatches && priorityMatchesWithoutScore.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllAdminMatches(true)}
                  className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-center text-sm font-bold text-slate-100 transition hover:bg-slate-800 sm:rounded-2xl"
                >
                  הצג את כל המשחקים
                </button>
              )}
            </>
          )}
        </div>

        <Link
          href={`/league/${code}`}
          className="mt-5 block text-center text-xs text-slate-400 hover:text-white sm:mt-6 sm:text-sm"
        >
          חזור לעמוד הליגה
        </Link>
      </div>
    </main>
  );
}

function MatchAdminCard({
  match,
  onUpdateScore,
  onUpdateMatch,
  onDeleteMatch,
}: {
  match: Match;
  onUpdateScore: (matchId: string, homeScore: string, awayScore: string) => void;
  onUpdateMatch: (
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    startTime: string
  ) => void;
  onDeleteMatch: (matchId: string) => void;
}) {
  const [homeScore, setHomeScore] = useState(
    match.home_score !== null ? String(match.home_score) : ""
  );
  const [awayScore, setAwayScore] = useState(
    match.away_score !== null ? String(match.away_score) : ""
  );

  const [editHomeTeam, setEditHomeTeam] = useState(match.home_team);
  const [editAwayTeam, setEditAwayTeam] = useState(match.away_team);
  const [editStartTime, setEditStartTime] = useState(
    formatDateTimeForInput(match.start_time)
  );

  const [isEditing, setIsEditing] = useState(false);

  const isFinished = match.status === "finished";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:rounded-3xl sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <span
          className={`rounded-full px-2 py-1 text-[11px] font-bold sm:px-3 sm:text-xs ${
            isFinished
              ? "bg-green-500/20 text-green-300"
              : "bg-blue-500/20 text-blue-300"
          }`}
        >
          {isFinished ? "הסתיים" : "טרם שוחק"}
        </span>

        <div className="min-w-16 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-center sm:min-w-20 sm:rounded-2xl sm:px-4">
          <p className="text-[10px] text-slate-500 sm:text-xs">תוצאה</p>
          <p className="text-lg font-black sm:text-xl">
            {isFinished ? `${match.home_score} - ${match.away_score}` : "-"}
          </p>
        </div>
      </div>

      {!isEditing ? (
        <>
          <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:mb-4 sm:gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2 text-center sm:rounded-2xl sm:p-4">
              <p className="mb-1 text-[10px] text-slate-500 sm:text-xs">
                בית
              </p>
              <p className="truncate text-base font-black sm:text-2xl">
                {match.home_team}
              </p>
            </div>

            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-400/10 text-[10px] font-black text-yellow-300 sm:h-12 sm:w-12 sm:text-sm">
              נגד
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2 text-center sm:rounded-2xl sm:p-4">
              <p className="mb-1 text-[10px] text-slate-500 sm:text-xs">
                חוץ
              </p>
              <p className="truncate text-base font-black sm:text-2xl">
                {match.away_team}
              </p>
            </div>
          </div>

          <p className="mb-3 text-center text-xs text-slate-400 sm:mb-4 sm:text-sm">
            {new Date(match.start_time).toLocaleString("he-IL")}
          </p>
        </>
      ) : (
        <div className="mb-3 space-y-3 sm:mb-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                בית
              </label>
              <input
                type="text"
                value={editHomeTeam}
                onChange={(event) => setEditHomeTeam(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-center text-sm font-bold outline-none focus:border-green-400 sm:text-base"
              />
            </div>

            <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-400/10 text-[10px] font-black text-yellow-300 sm:h-11 sm:w-11">
              נגד
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                חוץ
              </label>
              <input
                type="text"
                value={editAwayTeam}
                onChange={(event) => setEditAwayTeam(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-center text-sm font-bold outline-none focus:border-green-400 sm:text-base"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-slate-400">
              תאריך ושעה
            </label>
            <input
              type="datetime-local"
              value={editStartTime}
              onChange={(event) => setEditStartTime(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-green-400 sm:text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onUpdateMatch(
                  match.id,
                  editHomeTeam,
                  editAwayTeam,
                  editStartTime
                );
                setIsEditing(false);
              }}
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-4 py-3 text-sm font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02]"
            >
              שמור עריכה
            </button>

            <button
              type="button"
              onClick={() => {
                setEditHomeTeam(match.home_team);
                setEditAwayTeam(match.away_team);
                setEditStartTime(formatDateTimeForInput(match.start_time));
                setIsEditing(false);
              }}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold transition hover:bg-slate-800"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <input
          type="number"
          min="0"
          value={homeScore}
          onChange={(event) => setHomeScore(event.target.value)}
          placeholder="בית"
          className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-center text-lg font-black outline-none transition focus:border-green-400 sm:text-xl"
        />

        <input
          type="number"
          min="0"
          value={awayScore}
          onChange={(event) => setAwayScore(event.target.value)}
          placeholder="חוץ"
          className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-center text-lg font-black outline-none transition focus:border-green-400 sm:text-xl"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onUpdateScore(match.id, homeScore, awayScore)}
          className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-4 py-3 text-sm font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02]"
        >
          עדכן תוצאה
        </button>

        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="rounded-xl border border-white/10 bg-blue-600/80 px-4 py-3 text-sm font-bold transition hover:bg-blue-600"
        >
          {isEditing ? "סגור עריכה" : "ערוך משחק"}
        </button>

        <button
          type="button"
          onClick={() => onDeleteMatch(match.id)}
          className="rounded-xl border border-red-400/20 bg-red-600/80 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600"
        >
          מחק משחק
        </button>
      </div>
    </div>
  );
}
