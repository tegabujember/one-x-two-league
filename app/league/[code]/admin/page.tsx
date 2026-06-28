// /one-x-two-league/app/league/[code]/admin/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import ThemeToggle from "@/components/theme/ThemeToggle";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/dictionaries/he";
import type { TranslationParams } from "@/lib/i18n/config";

type League = {
  id: string;
  name: string;
  code: string;
  admin_code: string | null;
  owner_id: string | null;
  active_stage_id: string;
  predictions_locked: boolean;
  admin_edit_mode: boolean;
};

type LeagueStage = {
  id: string;
  league_id: string;
  stage_code: string;
  display_name: string;
  sort_order: number;
  predictions_locked: boolean;
  admin_edit_mode: boolean;
  created_at: string;
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
  stage_id: string;
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

type PlayerActivity = {
  id: string;
  name: string;
  last_seen_at: string | null;
};

type Translator = (key: TranslationKey, params?: TranslationParams) => string;

function formatDateTimeForInput(dateString: string) {
  const date = new Date(dateString);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

function isSameLocalDate(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function formatAdminLastSeen(
  lastSeenAt: string | null,
  locale: string,
  t: Translator
) {
  if (!lastSeenAt) {
    return t("admin.neverSeen");
  }

  const lastSeenDate = new Date(lastSeenAt);

  if (Number.isNaN(lastSeenDate.getTime())) {
    return t("admin.neverSeen");
  }

  const now = new Date();
  const minutesAgo = Math.max(
    0,
    Math.floor((now.getTime() - lastSeenDate.getTime()) / 60000)
  );
  const timeText = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(lastSeenDate);

  if (minutesAgo < 3) {
    return t("admin.seenNow");
  }

  if (minutesAgo < 60) {
    return t("admin.seenMinutesAgo", { count: minutesAgo });
  }

  if (isSameLocalDate(lastSeenDate, now)) {
    return t("admin.seenToday", { time: timeText });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameLocalDate(lastSeenDate, yesterday)) {
    return t("admin.seenYesterday", { time: timeText });
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(lastSeenDate);
}

function parseImportDate(dateText: string, t: Translator) {
  const match = dateText
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(t("admin.invalidDateFormat", { date: dateText }));
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
    throw new Error(t("admin.invalidDate", { date: dateText }));
  }

  return date.toISOString();
}

function parseMatchesImportText(text: string, t: Translator): ImportedMatch[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error(t("admin.noMatchesPasted"));
  }

  return lines.map((line, index) => {
    const parts = line.split("|").map((part) => part.trim());

    if (parts.length !== 3 && parts.length !== 4) {
      throw new Error(
        t("admin.invalidMatchLineFormat", { line: index + 1 })
      );
    }

    const [dateText, homeTeam, awayTeam, scoreText] = parts;

    if (!dateText || !homeTeam || !awayTeam) {
      throw new Error(t("admin.missingLineData", { line: index + 1 }));
    }

    const importedMatch: ImportedMatch = {
      home_team: homeTeam,
      away_team: awayTeam,
      start_time: parseImportDate(dateText, t),
    };

    if (scoreText !== undefined) {
      const scoreParts = scoreText.split("-").map((part) => part.trim());

      if (scoreParts.length !== 2) {
        throw new Error(
          t("admin.invalidScoreExampleLine", { line: index + 1 })
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
        throw new Error(t("admin.invalidScoreLine", { line: index + 1 }));
      }

      importedMatch.home_score = homeScore;
      importedMatch.away_score = awayScore;
    }

    return importedMatch;
  });
}

function parsePredictionsImportText(
  text: string,
  t: Translator
): ImportedPrediction[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error(t("admin.noPredictionsPasted"));
  }

  return lines.map((line, index) => {
    const parts = line.split("|").map((part) => part.trim());

    if (parts.length !== 4) {
      throw new Error(
        t("admin.invalidPredictionLineFormat", { line: index + 1 })
      );
    }

    const [dateText, homeTeam, awayTeam, pickText] = parts;
    const pick = pickText.toUpperCase();

    if (!dateText || !homeTeam || !awayTeam || !pick) {
      throw new Error(t("admin.missingLineData", { line: index + 1 }));
    }

    if (pick !== "1" && pick !== "X" && pick !== "2") {
      throw new Error(t("admin.invalidPickLine", { line: index + 1 }));
    }

    return {
      home_team: homeTeam,
      away_team: awayTeam,
      start_time: parseImportDate(dateText, t),
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

function parseResultLine(line: string, t: Translator): ImportedResult {
  const parts = line.split("|").map((part) => part.trim());

  if (parts.length !== 4) {
    throw new Error(t("admin.resultFormat"));
  }

  const [dateText, homeTeam, awayTeam, scoreText] = parts;

  if (!dateText || !homeTeam || !awayTeam || !scoreText) {
    throw new Error(t("admin.lineMissingData"));
  }

  const scoreParts = scoreText.split("-").map((part) => part.trim());

  if (scoreParts.length !== 2) {
    throw new Error(t("admin.invalidScoreExample"));
  }

  const homeScore = Number(scoreParts[0]);
  const awayScore = Number(scoreParts[1]);

  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0
  ) {
    throw new Error(t("admin.scorePositive"));
  }

  return {
    home_team: homeTeam,
    away_team: awayTeam,
    start_time: parseImportDate(dateText, t),
    home_score: homeScore,
    away_score: awayScore,
  };
}

export default function LeagueAdminPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { locale, dir, t } = useLanguage();

  const code = String(params.code).toUpperCase();

  const [league, setLeague] = useState<League | null>(null);
  const [stages, setStages] = useState<LeagueStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerActivity, setPlayerActivity] = useState<PlayerActivity[]>([]);
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
  const [customAiTournament, setCustomAiTournament] = useState("");
  const [matchImportMethod, setMatchImportMethod] = useState<"ai" | "manual">("ai");
  const [isCheckingAiMatches, setIsCheckingAiMatches] = useState(false);

  const [predictionPlayerId, setPredictionPlayerId] = useState("");
  const [predictionImportText, setPredictionImportText] = useState("");
  const [isImportingPredictions, setIsImportingPredictions] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingStage, setIsLoadingStage] = useState(false);
  const [isLoadingPlayerActivity, setIsLoadingPlayerActivity] =
    useState(false);
  const [showAllAdminMatches, setShowAllAdminMatches] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const stageLoadRequestIdRef = useRef(0);

  const selectedStage =
    stages.find((stage) => stage.id === selectedStageId) || null;
  const activeStage =
    stages.find((stage) => stage.id === league?.active_stage_id) || null;
  const selectedStageKind =
    selectedStage?.id === league?.active_stage_id
      ? "active"
      : activeStage && selectedStage
        ? selectedStage.sort_order < activeStage.sort_order
          ? "history"
          : "future"
        : null;

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  const loadLeagueAndMatches = useCallback(async (preferredStageId?: string) => {
    const requestId = ++stageLoadRequestIdRef.current;
    const isStageReload = Boolean(preferredStageId);
    const isStaleRequest = () => requestId !== stageLoadRequestIdRef.current;
    const finishLoading = () => {
      if (isStaleRequest()) return;

      if (isStageReload) {
        setIsLoadingStage(false);
      } else {
        setIsLoadingPage(false);
      }
    };

    setMatches([]);

    if (isStageReload) {
      setIsLoadingStage(true);
    } else {
      setIsLoadingPage(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isStaleRequest()) return;

    const { data: leagueData, error: leagueError } = await supabase
      .from("leagues")
      .select("*")
      .eq("code", code)
      .single();

    if (isStaleRequest()) return;

    if (leagueError || !leagueData) {
      console.error(leagueError);
      setMatches([]);
      finishLoading();
      showToast(t("admin.leagueNotFound"), "error");
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
      showToast(t("admin.noAdminPermission"), "error");
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

    const { data: stagesData, error: stagesError } = await supabase
      .from("league_stages")
      .select("*")
      .eq("league_id", leagueData.id)
      .order("sort_order", { ascending: true });

    if (isStaleRequest()) return;

    if (stagesError) {
      console.error(stagesError);
      showToast(t("admin.loadStagesError"), "error");
      setMatches([]);
      finishLoading();
      return;
    }

    const normalizedStages = ((stagesData || []) as LeagueStage[]).map(
      (stage) => ({
        ...stage,
        predictions_locked: Boolean(stage.predictions_locked),
        admin_edit_mode: Boolean(stage.admin_edit_mode),
      })
    );

    const resolvedStage =
      normalizedStages.find((stage) => stage.id === preferredStageId) ||
      normalizedStages.find(
        (stage) => stage.id === leagueData.active_stage_id
      );

    if (!resolvedStage) {
      showToast(t("admin.activeStageNotFound"), "error");
      setMatches([]);
      finishLoading();
      return;
    }

    setStages(normalizedStages);
    setSelectedStageId(resolvedStage.id);

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("id, league_id, name, user_id")
      .eq("league_id", leagueData.id)
      .order("created_at", { ascending: true });

    if (isStaleRequest()) return;

    if (playersError) {
      console.error(playersError);
      showToast(t("admin.loadPlayersError"), "error");
      setMatches([]);
      finishLoading();
      return;
    }

    setPlayers(playersData || []);

    if (isAccountOwner) {
      setIsLoadingPlayerActivity(true);

      void (async () => {
        try {
          const activityResponse = await fetch(
            `/api/leagues/${encodeURIComponent(code)}/player-activity`
          );

          if (isStaleRequest()) return;

          if (activityResponse.ok) {
            const activityData = (await activityResponse.json()) as {
              players?: PlayerActivity[];
            };

            setPlayerActivity(activityData.players || []);
          } else {
            console.error(await activityResponse.json().catch(() => null));
            setPlayerActivity([]);
          }
        } catch (error) {
          if (isStaleRequest()) return;

          console.error(error);
          setPlayerActivity([]);
        } finally {
          if (!isStaleRequest()) {
            setIsLoadingPlayerActivity(false);
          }
        }
      })();
    } else {
      setPlayerActivity([]);
      setIsLoadingPlayerActivity(false);
    }

    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .eq("league_id", leagueData.id)
      .eq("stage_id", resolvedStage.id)
      .order("start_time", { ascending: true });

    if (isStaleRequest()) return;

    if (matchesError) {
      console.error(matchesError);
      showToast(t("admin.loadMatchesError"), "error");
      setMatches([]);
      finishLoading();
      return;
    }

    setMatches(matchesData || []);
    finishLoading();
  }, [code, router, showToast, supabase, t]);

  useEffect(() => {
    // Initial external data synchronization for this client-only admin page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLeagueAndMatches();
  }, [loadLeagueAndMatches]);

  function clearStageSpecificState() {
    setHomeTeam("");
    setAwayTeam("");
    setStartTime("");
    setImportText("");
    setResultImportText("");
    setResultPreview([]);
    setPredictionPlayerId("");
    setPredictionImportText("");
    setShowAllAdminMatches(false);
  }

  async function handleAdminStageChange(stageId: string) {
    if (!stageId || stageId === selectedStageId) return;

    setSelectedStageId(stageId);
    setMatches([]);
    clearStageSpecificState();
    await loadLeagueAndMatches(stageId);
  }

  async function activateSelectedStage() {
    if (!league || !selectedStage || !isAccountOwner) {
      showToast(t("admin.ownerActiveStageOnly"), "error");
      return;
    }

    if (selectedStage.id === league.active_stage_id) return;

    const shouldActivate = confirm(
      t("admin.activateStageConfirm", { stage: selectedStage.display_name })
    );

    if (!shouldActivate) return;

    const response = await fetch(`/api/leagues/${code}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        active_stage_id: selectedStage.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast(t("admin.loginRequired"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.ownerActiveStageOnly"), "error");
      } else {
        showToast(t("admin.updateActiveStageError"), "error");
      }

      return;
    }

    await loadLeagueAndMatches(selectedStage.id);
    showToast(
      t("admin.stageActivated", { stage: selectedStage.display_name }),
      "success"
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!league || !selectedStage) {
      showToast(t("admin.leagueNotLoaded"), "error");
      return;
    }

    if (!homeTeam.trim() || !awayTeam.trim() || !startTime.trim()) {
      showToast(t("admin.matchFieldsRequired"), "warning");
      return;
    }

    setIsLoading(true);

    const response = await fetch(`/api/leagues/${code}/matches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage_id: selectedStage.id,
        home_team: homeTeam.trim(),
        away_team: awayTeam.trim(),
        start_time: new Date(startTime).toISOString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast(t("admin.loginToAddMatch"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.noAddMatchPermission"), "error");
      } else {
        showToast(t("admin.addMatchError"), "error");
      }

      setIsLoading(false);
      return;
    }

    setHomeTeam("");
    setAwayTeam("");
    setStartTime("");
    setIsLoading(false);

    await loadLeagueAndMatches(selectedStage.id);
    showToast(t("admin.matchAdded"), "success");
  }

  async function importMatchesFromText() {
  if (!selectedStage) {
    showToast(t("admin.chooseStage"), "warning");
    return;
  }

  if (!importText.trim()) {
    showToast(t("admin.pasteMatchList"), "warning");
    return;
  }

  let parsedMatches: ImportedMatch[];

  try {
    parsedMatches = parseMatchesImportText(importText, t);
  } catch (error) {
    console.error(error);
    showToast(
      error instanceof Error ? error.message : t("admin.readListError"),
      "error"
    );
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
    showToast(t("admin.noNewMatches"), "warning");
    return;
  }

  const shouldImport = confirm(
    t("admin.importMatchesConfirm", {
      total: parsedMatches.length,
      newCount: newMatches.length,
      skipped: skippedExisting,
    })
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
        stage_id: selectedStage.id,
        matches: newMatches,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast(t("admin.loginToImportMatches"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.noImportMatchesPermission"), "error");
      } else {
        showToast(t("admin.importMatchesError"), "error");
      }

      return;
    }

    const data = await response.json();

    setImportText("");

    await loadLeagueAndMatches(selectedStage.id);

    showToast(
      t("admin.importMatchesSuccess", {
        imported: data.imported,
        skipped: skippedExisting,
        finished: data.finished ?? 0,
        upcoming: data.upcoming ?? 0,
      }),
      "success"
    );
  } catch (error) {
    console.error(error);
    showToast(t("admin.importMatchesUnexpected"), "error");
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
    showToast(t("admin.pasteResults"), "warning");
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
      imported = parseResultLine(line, t);
    } catch (error) {
      return {
        lineNumber,
        rawLine: line,
        status: "invalid",
        message: error instanceof Error ? error.message : t("admin.invalidLine"),
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
        message: t("admin.duplicateLine"),
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
        message: t("admin.resultMatchNotFound"),
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
        message: t("admin.resultAlreadyExists"),
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
      message: t("admin.resultReady"),
      imported,
      matchId: existingMatch.id,
    };
  });

  setResultPreview(previewItems);
  setIsCheckingResults(false);

  const readyCount = previewItems.filter(
    (item) => item.status === "ready"
  ).length;

  showToast(t("admin.resultsChecked", { count: readyCount }), "success");
}

async function checkResultsWithAi() {
  if (!selectedStage) {
    showToast(t("admin.chooseStage"), "warning");
    return;
  }

  setIsCheckingAiResults(true);

  try {
    const response = await fetch(`/api/leagues/${code}/ai-results`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage_id: selectedStage.id,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | AiResultResponse
      | { error?: string }
      | null;

    if (!response.ok) {
      console.error(data);

      showToast(t("admin.aiResultsError"), "error");
      return;
    }

    const aiData = data as AiResultResponse;

    if (aiData.results.length === 0) {
      showToast(t("admin.noFinalResults"), "info");
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
        ? ` ${t("admin.aiMissingResults", { count: aiData.missingCount })}`
        : "";

    showToast(
      t("admin.aiResultsFound", {
        count: aiData.foundCount,
        extra: extraMessage,
      }),
      "success"
    );
  } catch (error) {
    console.error(error);
    showToast(t("admin.aiResultsError"), "error");
  } finally {
    setIsCheckingAiResults(false);
  }
}

async function checkMatchesWithAi() {
  if (!selectedStage) {
    showToast(t("admin.chooseStage"), "warning");
    return;
  }

  const tournament =
    aiTournament === "טורניר אחר"
      ? customAiTournament.trim()
      : aiTournament;

  if (!tournament) {
    showToast(t("admin.tournamentRequired"), "warning");
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
        stage: selectedStage.display_name,
        stage_id: selectedStage.id,
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

      showToast(t("admin.aiMatchesError"), "error");
      return;
    }

    const aiMatches = data?.matches || [];

    if (aiMatches.length === 0) {
      showToast(t("admin.noNewStageMatches"), "info");
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

    showToast(
      t("admin.aiMatchesFound", { count: aiMatches.length }),
      "success"
    );
  } catch (error) {
    console.error(error);
    showToast(t("admin.aiMatchesUnexpected"), "error");
  } finally {
    setIsCheckingAiMatches(false);
  }
}

  async function importCheckedResults() {
    const readyItems = resultPreview.filter(
      (item) => item.status === "ready" && item.imported && item.matchId
    );

    if (readyItems.length === 0) {
      showToast(t("admin.noReadyResults"), "warning");
      return;
    }

    const shouldUpdate = confirm(
      t("admin.updateResultsConfirm", { count: readyItems.length })
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
        currentMatch.stage_id !== selectedStageId ||
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
            stage_id: selectedStageId,
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

    if (selectedStage) {
      await loadLeagueAndMatches(selectedStage.id);
    }

    if (updated > 0) {
      setResultImportText("");
      setResultPreview([]);
    }

    showToast(
      t("admin.resultsUpdateSummary", {
        updated,
        skipped: skippedExisting,
        failed,
      }),
      failed > 0 ? "warning" : "success"
    );
  }

  async function importPredictionsFromText() {
    if (!selectedStage) {
      showToast(t("admin.chooseStage"), "warning");
      return;
    }

    if (!predictionPlayerId) {
      showToast(t("admin.choosePlayerWarning"), "warning");
      return;
    }

    if (!predictionImportText.trim()) {
      showToast(t("admin.pastePredictions"), "warning");
      return;
    }

    let parsedPredictions: ImportedPrediction[];

    try {
      parsedPredictions = parsePredictionsImportText(predictionImportText, t);
    } catch (error) {
      console.error(error);
      showToast(
        error instanceof Error
          ? error.message
          : t("admin.readPredictionsError"),
        "error"
      );
      return;
    }

    const selectedPlayer = players.find(
      (player) => player.id === predictionPlayerId
    );

    const shouldImport = confirm(
      selectedPlayer
        ? t("admin.importPredictionsForPlayerConfirm", {
            count: parsedPredictions.length,
            name: selectedPlayer.name,
          })
        : t("admin.importPredictionsConfirm", {
            count: parsedPredictions.length,
          })
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
        stage_id: selectedStage.id,
        player_id: predictionPlayerId,
        predictions: parsedPredictions,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast(t("admin.loginToImportPredictions"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.noImportPredictionsPermission"), "error");
      } else if (response.status === 400) {
        showToast(t("admin.invalidPredictions"), "error");
      } else {
        showToast(t("admin.importPredictionsError"), "error");
      }

      setIsImportingPredictions(false);
      return;
    }

    const data = await response.json();

    setPredictionImportText("");
    setPredictionPlayerId("");
    setIsImportingPredictions(false);

    showToast(
      t("admin.importPredictionsSuccess", {
        imported: data.imported,
        skipped: data.skippedExisting ?? 0,
        locked: data.skippedLocked ?? 0,
      }),
      "success"
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
      showToast(t("common.signOutError"), "error");
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
    if (!league || !selectedStage) {
      showToast(t("admin.leagueNotLoaded"), "error");
      return;
    }

    if (!isAccountOwner) {
      showToast(t("admin.ownerLockOnly"), "error");
      return;
    }

    const nextLockedValue = !selectedStage.predictions_locked;

    const message = nextLockedValue
      ? t("admin.lockConfirm", { stage: selectedStage.display_name })
      : t("admin.unlockConfirm", { stage: selectedStage.display_name });

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
        stage_id: selectedStage.id,
        predictions_locked: nextLockedValue,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast(t("admin.loginRequired"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.noLockPermission"), "error");
      } else {
        showToast(t("admin.lockUpdateError"), "error");
      }

      return;
    }

    await loadLeagueAndMatches(selectedStage.id);

    showToast(
      nextLockedValue
        ? t("admin.predictionsLockedAll")
        : t("admin.predictionsOpened"),
      "success"
    );
  }

  async function toggleAdminEditMode() {
    if (!league || !selectedStage) {
      showToast(t("admin.leagueNotLoaded"), "error");
      return;
    }

    if (!isAccountOwner) {
      showToast(t("admin.ownerEditModeOnly"), "error");
      return;
    }

    if (!selectedStage.predictions_locked) {
      showToast(t("admin.editModeRequiresLock"), "warning");
      return;
    }

    const nextAdminEditMode = !selectedStage.admin_edit_mode;

    const message = nextAdminEditMode
      ? t("admin.enableEditModeConfirm")
      : t("admin.disableEditModeConfirm");

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
        stage_id: selectedStage.id,
        admin_edit_mode: nextAdminEditMode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast(t("admin.loginRequired"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.noEditModePermission"), "error");
      } else {
        showToast(t("admin.editModeUpdateError"), "error");
      }

      return;
    }

    await loadLeagueAndMatches(selectedStage.id);

    showToast(
      nextAdminEditMode
        ? t("admin.editModeEnabled")
        : t("admin.editModeDisabled"),
      "success"
    );
  }

  async function updateScore(
    matchId: string,
    homeScore: string,
    awayScore: string
  ) {
    const loadedMatch = matches.find((match) => match.id === matchId);

    if (!loadedMatch || loadedMatch.stage_id !== selectedStageId) {
      showToast(t("admin.matchWrongStage"), "error");
      return;
    }

    if (homeScore === "" || awayScore === "") {
      showToast(t("admin.twoScoresRequired"), "warning");
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
      showToast(t("admin.scoreNonNegative"), "warning");
      return;
    }

    const response = await fetch(`/api/leagues/${code}/matches/${matchId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage_id: selectedStageId,
        home_score: homeScoreNumber,
        away_score: awayScoreNumber,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast(t("admin.loginToUpdateResult"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.noUpdateResultPermission"), "error");
      } else {
        showToast(t("admin.updateResultError"), "error");
      }

      return;
    }

    await loadLeagueAndMatches(selectedStageId);
    showToast(t("admin.resultUpdated"), "success");
  }

  async function updateMatchDetails(
    matchId: string,
    homeTeamValue: string,
    awayTeamValue: string,
    startTimeValue: string
  ) {
    const loadedMatch = matches.find((match) => match.id === matchId);

    if (!loadedMatch || loadedMatch.stage_id !== selectedStageId) {
      showToast(t("admin.matchWrongStage"), "error");
      return;
    }

    if (
      !homeTeamValue.trim() ||
      !awayTeamValue.trim() ||
      !startTimeValue.trim()
    ) {
      showToast(t("admin.matchFieldsRequired"), "warning");
      return;
    }

    const response = await fetch(`/api/leagues/${code}/matches/${matchId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage_id: selectedStageId,
        home_team: homeTeamValue.trim(),
        away_team: awayTeamValue.trim(),
        start_time: new Date(startTimeValue).toISOString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast(t("admin.loginToEditMatch"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.noEditMatchPermission"), "error");
      } else {
        showToast(t("admin.editMatchError"), "error");
      }

      return;
    }

    await loadLeagueAndMatches(selectedStageId);
    showToast(t("admin.matchUpdated"), "success");
  }

  async function deleteMatch(matchId: string) {
    const loadedMatch = matches.find((match) => match.id === matchId);

    if (!loadedMatch || loadedMatch.stage_id !== selectedStageId) {
      showToast(t("admin.matchWrongStage"), "error");
      return;
    }

    const shouldDelete = confirm(t("admin.deleteMatchConfirm"));

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
        showToast(t("admin.loginToDeleteMatch"), "warning");
      } else if (response.status === 403) {
        showToast(t("admin.noDeleteMatchPermission"), "error");
      } else {
        showToast(t("admin.deleteMatchError"), "error");
      }

      return;
    }

    await loadLeagueAndMatches(selectedStageId);
    showToast(t("admin.matchDeleted"), "success");
  }

  if (isLoadingPage) {
    return (
      <main className="theme-admin-page theme-page relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="theme-admin-decoration absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />

        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-3xl">🏆</span>
          </div>

          <p className="theme-muted font-semibold">{t("admin.loading")}</p>
        </div>
      </main>
    );
  }

  const importModeTitle =
    importMode === "matches"
      ? t("admin.importMatches")
      : importMode === "results"
        ? t("admin.updateExistingResults")
        : t("admin.importPlayerPredictions");

  return (
    <main className="theme-admin-page theme-page relative min-h-screen overflow-hidden px-3 py-5 sm:px-4 sm:py-8">
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
        <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
          <button
            type="button"
            title={t("common.account")}
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            className="theme-neutral-button flex h-11 w-11 items-center justify-center rounded-full border text-xl shadow-lg shadow-black/30 backdrop-blur transition hover:scale-105"
          >
            👤
          </button>

          {isAccountMenuOpen && (
            <div className="theme-popover absolute end-0 mt-3 w-64 rounded-2xl border p-4 text-start backdrop-blur">
              <p className="theme-muted mb-1 text-xs">{t("common.connectedAs")}</p>

              <p className="mb-4 break-all text-sm font-bold text-green-300" dir="ltr">
                <bdi>{adminEmail}</bdi>
              </p>

              <div className="mb-4 flex justify-end">
                <ThemeToggle />
              </div>

              <div className="mb-4 flex justify-end">
                <LanguageToggle />
              </div>

              <button
                type="button"
                onClick={signOut}
                disabled={isSigningOut}
                className="w-full rounded-xl bg-gradient-to-r from-red-500 to-rose-700 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSigningOut ? t("common.signingOut") : t("common.signOut")}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="theme-admin-decoration absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.20),_transparent_32%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.18),_transparent_34%)]" />
      <div className="theme-admin-decoration absolute top-10 left-8 h-20 w-20 rounded-full bg-green-500/20 blur-3xl" />
      <div className="theme-admin-decoration absolute bottom-10 right-8 h-24 w-24 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-3xl">
        <div className="mb-4 text-center sm:mb-6">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30 sm:h-16 sm:w-16">
            <span className="text-2xl sm:text-3xl">🛠️</span>
          </div>

          <p className="text-[10px] font-semibold tracking-[0.28em] text-green-300 sm:text-xs sm:tracking-[0.35em]">
            {t("admin.kicker")}
          </p>
        </div>

        <div className="theme-card theme-admin-section mb-4 rounded-2xl border p-4 backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
          <div className="text-center">
            <p className="theme-muted mb-1 text-xs sm:text-sm">
              {t("admin.title")}
            </p>

            <h1 className="text-2xl font-black tracking-tight sm:text-4xl">
              {t("admin.subtitle")}
            </h1>

            {league && (
              <div className="theme-panel theme-admin-panel mt-4 inline-flex flex-col items-center rounded-xl border px-4 py-2 sm:mt-5 sm:rounded-2xl sm:px-5 sm:py-3">
                <span className="text-base font-bold sm:text-lg">
                  <bdi>{league.name}</bdi>
                </span>

                <span className="theme-muted mt-1 text-xs sm:text-sm">
                  {t("admin.leagueCode")} {" "}
                  <span className="theme-league-code font-black tracking-widest" dir="ltr">
                    <bdi>{league.code}</bdi>
                  </span>
                </span>

                {adminEmail && (
                  <span className="mt-2 rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1 text-[11px] font-bold text-green-300">
                    {t("admin.adminConnected")} <bdi dir="ltr">{adminEmail}</bdi>
                  </span>
                )}

                {selectedStage && (
                  <div className="theme-panel theme-admin-panel mt-4 w-full rounded-2xl border p-3 text-start">
                    <label
                      htmlFor="admin-stage-selector"
                      className="theme-muted mb-2 block text-xs font-bold"
                    >
                      {t("admin.stageToManage")}
                    </label>
                    <select
                      id="admin-stage-selector"
                      value={selectedStage.id}
                      onChange={(event) =>
                        handleAdminStageChange(event.target.value)
                      }
                      disabled={
                        isLoadingStage ||
                        isLoading ||
                        isImporting ||
                        isUpdatingResults ||
                        isCheckingAiResults ||
                        isCheckingAiMatches ||
                        isImportingPredictions
                      }
                      className="theme-input w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none transition focus:border-green-400 disabled:opacity-50"
                    >
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.display_name}
                        </option>
                      ))}
                    </select>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                          selectedStageKind === "active"
                            ? "bg-green-500/15 text-green-300"
                            : selectedStageKind === "history"
                              ? "bg-blue-500/15 text-blue-300"
                              : "bg-violet-500/15 text-violet-300"
                        }`}
                      >
                        {selectedStageKind === "active"
                          ? t("admin.stageActive")
                          : selectedStageKind === "history"
                            ? t("admin.stageHistory")
                            : t("admin.stageFuture")}
                      </span>

                      {isAccountOwner && selectedStageKind !== "active" && (
                        <button
                          type="button"
                          onClick={activateSelectedStage}
                          className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-700 px-3 py-2 text-xs font-black text-white transition hover:scale-[1.02]"
                        >
                          {t("admin.makeActive")}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedStage && (
                <div className="theme-panel theme-admin-panel mt-4 w-full rounded-2xl border p-3">
                  <p className="theme-muted mb-3 text-xs font-bold">
                    {t("admin.predictionsStatus", {
                      stage: selectedStage.display_name,
                    })} {" "}
                    <span
                      className={
                        selectedStage.predictions_locked
                          ? "text-red-300"
                          : "text-green-300"
                      }
                    >
                      {selectedStage.predictions_locked
                        ? t("admin.locked")
                        : t("admin.open")}
                    </span>
                  </p>

                  {isAccountOwner ? (
                    <button
                      type="button"
                      onClick={toggleLeaguePredictionsLock}
                      className={`w-full rounded-xl px-4 py-3 text-sm font-black transition hover:scale-[1.02] ${
                        selectedStage.predictions_locked
                          ? "bg-gradient-to-r from-green-500 to-emerald-700 text-white"
                          : "bg-gradient-to-r from-red-500 to-rose-700 text-white"
                      }`}
                    >
                      {selectedStage.predictions_locked
                        ? t("admin.openStage")
                        : t("admin.lockStage")}
                    </button>
                  ) : (
                    <p className="theme-muted text-[11px]">
                      {t("admin.ownerSettingsOnly")}
                    </p>
                  )}

                  {selectedStage.predictions_locked && isAccountOwner && (
                    <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                      <p className="theme-warning-text mb-2 text-xs font-bold">
                        {t("admin.editMode")} {" "}
                        <span
                          className={
                            selectedStage.admin_edit_mode
                              ? "theme-warning-text"
                              : "theme-muted"
                          }
                        >
                          {selectedStage.admin_edit_mode
                            ? t("admin.on")
                            : t("admin.off")}
                        </span>
                      </p>

                      <p className="theme-warning-text mb-3 text-[11px] leading-5">
                        {t("admin.editModeHelp")}
                      </p>

                      <button
                        type="button"
                        onClick={toggleAdminEditMode}
                        className={`w-full rounded-xl px-4 py-3 text-sm font-black transition hover:scale-[1.02] ${
                          selectedStage.admin_edit_mode
                            ? "bg-gradient-to-r from-slate-600 to-slate-800 text-white"
                            : "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        }`}
                      >
                        {selectedStage.admin_edit_mode
                          ? t("admin.disableEditMode")
                          : t("admin.enableEditMode")}
                      </button>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
          </div>

          {isAccountOwner && (
            <div className="theme-panel theme-admin-panel mt-5 rounded-2xl border p-4 text-start sm:mt-6">
              <div className="theme-section-header mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-black sm:text-lg">
                  {t("admin.participantActivity")}
                </h2>

                <span className="theme-neutral-button shrink-0 rounded-full border px-3 py-1 text-[11px]">
                  {t("admin.participantsCount", { count: playerActivity.length })}
                </span>
              </div>

              {isLoadingPlayerActivity ? (
                <p className="theme-muted text-xs">{t("admin.loadingActivity")}</p>
              ) : playerActivity.length === 0 ? (
                <p className="theme-muted text-xs">
                  {t("admin.noParticipants")}
                </p>
              ) : (
                <div className="space-y-2">
                  {playerActivity.map((player) => (
                    <div
                      key={player.id}
                      className="theme-neutral-button flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm font-bold">
                        <bdi>{player.name}</bdi>
                      </span>

                      <span
                        className={`shrink-0 text-xs font-bold ${
                          player.last_seen_at
                            ? "text-green-300"
                            : "text-slate-500"
                        }`}
                      >
                        {formatAdminLastSeen(player.last_seen_at, locale, t)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3" dir="ltr">
              <div dir={dir}>
                <label className="theme-muted mb-2 block text-xs font-semibold sm:text-sm">
                  {t("admin.homeTeam")}
                </label>

                <input
                  type="text"
                  value={homeTeam}
                  onChange={(event) => setHomeTeam(event.target.value)}
                  placeholder={t("common.homeTeam")}
                  className="theme-input w-full rounded-xl border px-3 py-3 text-center text-sm outline-none transition focus:border-green-400 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base"
                />
              </div>

              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-400/10 text-xs font-black text-yellow-300 sm:mb-2 sm:h-12 sm:w-12">
                {t("admin.against")}
              </div>

              <div dir={dir}>
                <label className="theme-muted mb-2 block text-xs font-semibold sm:text-sm">
                  {t("admin.awayTeam")}
                </label>

                <input
                  type="text"
                  value={awayTeam}
                  onChange={(event) => setAwayTeam(event.target.value)}
                  placeholder={t("common.awayTeam")}
                  className="theme-input w-full rounded-xl border px-3 py-3 text-center text-sm outline-none transition focus:border-green-400 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base"
                />
              </div>
            </div>

            <div>
              <label className="theme-muted mb-2 block text-xs font-semibold sm:text-sm">
                {t("admin.dateTime")}
              </label>

              <input
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="theme-input w-full rounded-xl border px-3 py-3 text-sm outline-none transition focus:border-green-400 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-base"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
            >
              {isLoading ? t("admin.addingMatch") : t("admin.addMatch")}
            </button>
          </form>
        </div>

        <div className="theme-card theme-admin-section mb-4 rounded-2xl border p-4 backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
          <div className="theme-section-header mb-4">
            <h2 className="text-xl font-black sm:text-2xl">{t("admin.importData")}</h2>

            <p className="theme-muted mt-2 text-sm leading-6">
              {t("admin.importHelp")}
            </p>
          </div>

          <label className="theme-muted mb-2 block text-xs font-semibold sm:text-sm">
            {t("admin.importType")}
          </label>

          <select
            value={importMode}
            onChange={(event) => {
              setImportMode(event.target.value as ImportMode);
              setResultPreview([]);
            }}
            className="theme-input mb-4 w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none focus:border-green-400 sm:rounded-2xl sm:py-4 sm:text-base"
          >
            <option value="matches">{t("admin.importMatches")}</option>
            <option value="results">{t("admin.updateExistingResults")}</option>
            <option value="predictions">{t("admin.importPlayerPredictions")}</option>
          </select>

          <div className="theme-warning-text mb-4 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-xs leading-6">
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
                <p className="theme-warning-text mt-2">
                  {t("admin.resultsSafety")}
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
              <div className="theme-panel theme-admin-panel mb-5 grid grid-cols-2 gap-2 rounded-2xl p-2">
                <button
                  type="button"
                  onClick={() => setMatchImportMethod("ai")}
                  className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                    matchImportMethod === "ai"
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-700 text-white shadow-lg shadow-violet-950/40"
                      : "theme-muted hover:bg-green-500/10 hover:text-green-300"
                  }`}
                >
                  {t("admin.aiImport")}
                </button>

                <button
                  type="button"
                  onClick={() => setMatchImportMethod("manual")}
                  className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                    matchImportMethod === "manual"
                      ? "bg-gradient-to-r from-blue-500 to-indigo-700 text-white shadow-lg shadow-blue-950/40"
                      : "theme-muted hover:bg-green-500/10 hover:text-green-300"
                  }`}
                >
                  {t("admin.manualPaste")}
                </button>
              </div>

              {matchImportMethod === "ai" && (
                <div className="theme-ai-panel mb-5 rounded-2xl border border-violet-500/20 bg-violet-950/20 p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-black sm:text-lg">
                      {t("admin.aiMatchImport")}
                    </h3>

                    <p className="theme-muted mt-1 text-sm leading-6">
                      {t("admin.aiMatchHelp")}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="theme-muted mb-2 block text-sm font-bold">
                        {t("admin.tournament")}
                      </span>

                      <select
                        value={aiTournament}
                        onChange={(event) => setAiTournament(event.target.value)}
                        className="theme-input w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none transition focus:border-violet-400"
                      >
                        <option value="מונדיאל 2026">{t("admin.worldCup")}</option>
                        <option value="ליגת האלופות 2026/27">
                          {t("admin.championsLeague")}
                        </option>
                        <option value="פרמייר ליג 2026/27">
                          {t("admin.premierLeague")}
                        </option>
                        <option value="לה ליגה 2026/27">{t("admin.laLiga")}</option>
                        <option value="טורניר אחר">{t("admin.otherTournament")}</option>
                      </select>
                    </label>

                    <div className="block">
                      <span className="theme-muted mb-2 block text-sm font-bold">
                        {t("admin.selectedStage")}
                      </span>

                      <div className="theme-panel theme-info-text w-full rounded-xl border px-4 py-3 text-sm font-bold">
                        {selectedStage?.display_name || t("admin.noStageSelected")}
                      </div>
                    </div>
                  </div>

                  {aiTournament === "טורניר אחר" && (
                    <div className="mt-3">
                      <label className="block">
                        <span className="theme-muted mb-2 block text-sm font-bold">
                          {t("admin.tournamentName")}
                        </span>

                        <input
                          type="text"
                          value={customAiTournament}
                          onChange={(event) => setCustomAiTournament(event.target.value)}
                          placeholder={t("admin.tournamentPlaceholder")}
                          className="theme-input w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none transition focus:border-violet-400"
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
                      ? t("admin.aiSearchingMatches")
                      : t("admin.aiFetchMatches")}
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
                    dir="ltr"
                    className="theme-input w-full rounded-2xl border px-4 py-4 text-sm outline-none transition focus:border-green-400"
                  />

                  <button
                    type="button"
                    onClick={importMatchesFromText}
                    disabled={isImporting || !importText.trim()}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-950/40 transition hover:scale-[1.02] hover:from-purple-400 hover:to-fuchsia-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                  >
                    {isImporting
                      ? t("admin.importingMatches")
                      : t("admin.importMatchesButton")}
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
                dir="ltr"
                className="theme-input w-full rounded-2xl border px-4 py-4 text-sm outline-none transition focus:border-green-400"
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
                  className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-950/40 transition hover:scale-[1.02] hover:from-violet-400 hover:to-purple-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                >
                  {isCheckingAiResults
                    ? t("admin.searchingResults")
                    : t("admin.checkAiResults")}
                </button>
                <button
                  type="button"
                  onClick={() => previewResultsImport()}
                  disabled={
                    isCheckingResults ||
                    isUpdatingResults ||
                    !resultImportText.trim()
                  }
                  className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                >
                  {isCheckingResults
                    ? t("admin.checkingResults")
                    : t("admin.checkResults")}
                </button>
                <button
                  type="button"
                  onClick={importCheckedResults}
                  disabled={
                    isUpdatingResults ||
                    resultPreview.filter((item) => item.status === "ready")
                      .length === 0
                  }
                  className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                >
                  {isUpdatingResults
                    ? t("admin.updatingResults")
                    : t("admin.confirmResults")}
                </button>
              </div>

              {resultPreview.length > 0 && (
                <div className="mt-5 space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-green-400/20 bg-green-500/10 p-3 text-center">
                      <p className="theme-success-text text-xl font-black">
                        {
                          resultPreview.filter(
                            (item) => item.status === "ready"
                          ).length
                        }
                      </p>
                      <p className="theme-muted text-xs">{t("admin.ready")}</p>
                    </div>

                    <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-center">
                      <p className="theme-warning-text text-xl font-black">
                        {
                          resultPreview.filter(
                            (item) => item.status === "hasScore"
                          ).length
                        }
                      </p>
                      <p className="theme-muted text-xs">{t("admin.hasResult")}</p>
                    </div>

                    <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-center">
                      <p className="theme-danger-text text-xl font-black">
                        {
                          resultPreview.filter(
                            (item) =>
                              item.status === "notFound" ||
                              item.status === "invalid"
                          ).length
                        }
                      </p>
                      <p className="theme-muted text-xs">{t("admin.errors")}</p>
                    </div>

                    <div className="theme-panel rounded-xl border p-3 text-center">
                      <p className="text-xl font-black">
                        {
                          resultPreview.filter(
                            (item) => item.status === "duplicate"
                          ).length
                        }
                      </p>
                      <p className="theme-muted text-xs">{t("admin.duplicates")}</p>
                    </div>
                  </div>

                  {resultPreview.map((item) => (
                    <div
                      key={`${item.lineNumber}-${item.rawLine}`}
                      className={`rounded-xl border p-3 text-sm ${
                        item.status === "ready"
                          ? "border-green-400/20 bg-green-500/10 theme-success-text"
                          : item.status === "hasScore"
                            ? "border-yellow-400/20 bg-yellow-500/10 theme-warning-text"
                            : "border-red-400/20 bg-red-500/10 theme-danger-text"
                      }`}
                    >
                      <p className="font-bold">
                        {t("admin.lineNumber", { line: item.lineNumber })} {item.message}
                      </p>

                      <p className="mt-1 break-words text-xs opacity-80">
                        {item.rawLine}
                      </p>

                      {item.existingScore && (
                        <p className="mt-1 text-xs">
                          {t("admin.existingResult", {
                            score: item.existingScore,
                          })}
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
              <label className="theme-muted mb-2 block text-xs font-semibold sm:text-sm">
                {t("admin.choosePlayer")}
              </label>

              <select
                value={predictionPlayerId}
                onChange={(event) => setPredictionPlayerId(event.target.value)}
                className="theme-input mb-4 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-green-400 sm:rounded-2xl sm:py-4 sm:text-base"
              >
                <option value="">{t("admin.choosePlayer")}</option>

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
                dir="ltr"
                className="theme-input w-full rounded-2xl border px-4 py-4 text-sm outline-none transition focus:border-green-400"
              />

              <button
                type="button"
                onClick={importPredictionsFromText}
                disabled={
                  isImportingPredictions ||
                  !predictionImportText.trim() ||
                  !predictionPlayerId
                }
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/40 transition hover:scale-[1.02] hover:from-orange-400 hover:to-red-600 disabled:opacity-50 disabled:hover:scale-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
              >
                {isImportingPredictions
                  ? t("admin.importingPredictions")
                  : t("admin.importPredictionsButton")}
              </button>
            </>
          )}
        </div>

        <div className="theme-card theme-admin-section rounded-2xl border p-4 backdrop-blur-xl sm:rounded-3xl sm:p-6">
          <div className="theme-section-header mb-4 flex items-center justify-between gap-3 sm:mb-5">
            <div>
              <h2 className="text-xl font-black sm:text-2xl">{t("admin.manageMatches")}</h2>

              <p className="theme-muted mt-1 text-xs sm:text-sm">
                {showAllAdminMatches
                  ? t("admin.showingAllMatches")
                  : pastMatchesWithoutScore.length > 0
                    ? t("admin.showingPastWithoutResult")
                    : t("admin.showingUpcomingWithoutResult")}
              </p>
            </div>

            <span className="theme-panel theme-muted shrink-0 rounded-full border px-3 py-1 text-[11px] sm:px-4 sm:py-2 sm:text-xs">
              {showAllAdminMatches
                ? t("admin.matchesCount", { count: matches.length })
                : pastMatchesWithoutScore.length > 0
                  ? t("admin.pastWithoutResultCount", {
                      count: pastMatchesWithoutScore.length,
                    })
                  : t("admin.upcomingWithoutResultCount", {
                      count: upcomingMatchesWithoutScore.length,
                    })}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowAllAdminMatches(false)}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition sm:rounded-2xl ${
                !showAllAdminMatches
                  ? "bg-gradient-to-r from-green-500 to-emerald-700 text-white shadow-lg shadow-green-950/40"
                  : "theme-neutral-button border"
              }`}
            >
              {t("admin.matchesNeedUpdate")}
            </button>

            <button
              type="button"
              onClick={() => setShowAllAdminMatches(true)}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition sm:rounded-2xl ${
                showAllAdminMatches
                  ? "bg-gradient-to-r from-blue-500 to-indigo-700 text-white shadow-lg shadow-blue-950/40"
                  : "theme-neutral-button border"
              }`}
            >
              {t("admin.allMatches")}
            </button>
          </div>

          {isLoadingStage ? (
            <p className="theme-muted text-sm">{t("admin.loadingStageMatches")}</p>
          ) : matches.length === 0 ? (
            <p className="theme-muted text-sm">{t("admin.noMatchesToUpdate")}</p>
          ) : !showAllAdminMatches && priorityMatchesWithoutScore.length === 0 ? (
            <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-5 text-center">
              <p className="text-2xl">✅</p>
              <p className="mt-2 text-sm font-bold text-green-300">
                {t("admin.noWaitingMatches")}
              </p>
              <p className="theme-muted mt-1 text-xs">
                {t("admin.allMatchesHelp")}
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
                  className="theme-neutral-button mt-4 w-full rounded-xl border px-4 py-3 text-center text-sm font-bold transition sm:rounded-2xl"
                >
                  {t("admin.showAllMatches")}
                </button>
              )}
            </>
          )}
        </div>

        <Link
          href={`/league/${code}`}
          className="theme-muted mt-5 block text-center text-xs hover:text-green-300 sm:mt-6 sm:text-sm"
        >
          {t("admin.backToLeague")}
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
  const { locale, dir, t } = useLanguage();
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
    <div className="theme-panel theme-admin-panel rounded-2xl border p-3 sm:rounded-3xl sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <span
          className={`rounded-full px-2 py-1 text-[11px] font-bold sm:px-3 sm:text-xs ${
            isFinished
              ? "bg-green-500/20 text-green-300"
              : "bg-blue-500/20 text-blue-300"
          }`}
        >
          {isFinished ? t("league.finished") : t("admin.notPlayed")}
        </span>

        <div className="theme-panel theme-team-tile min-w-16 rounded-xl border px-3 py-2 text-center sm:min-w-20 sm:rounded-2xl sm:px-4">
          <p className="theme-muted text-[10px] sm:text-xs">{t("league.result")}</p>
          <p className="text-lg font-black sm:text-xl" dir="ltr">
            {isFinished ? `${match.home_score} - ${match.away_score}` : "-"}
          </p>
        </div>
      </div>

      {!isEditing ? (
        <>
          <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:mb-4 sm:gap-3" dir="ltr">
            <div className="theme-panel theme-team-tile rounded-xl border p-2 text-center sm:rounded-2xl sm:p-4" dir={dir}>
              <p className="theme-muted mb-1 text-[10px] sm:text-xs">
                {t("common.homeTeam")}
              </p>
              <p className="truncate text-base font-black sm:text-2xl">
                <bdi>{match.home_team}</bdi>
              </p>
            </div>

            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-400/10 text-[10px] font-black text-yellow-300 sm:h-12 sm:w-12 sm:text-sm">
              {t("admin.against")}
            </div>

            <div className="theme-panel theme-team-tile rounded-xl border p-2 text-center sm:rounded-2xl sm:p-4" dir={dir}>
              <p className="theme-muted mb-1 text-[10px] sm:text-xs">
                {t("common.awayTeam")}
              </p>
              <p className="truncate text-base font-black sm:text-2xl">
                <bdi>{match.away_team}</bdi>
              </p>
            </div>
          </div>

          <p className="theme-muted mb-3 text-center text-xs sm:mb-4 sm:text-sm">
            {new Date(match.start_time).toLocaleString(locale)}
          </p>
        </>
      ) : (
        <div className="mb-3 space-y-3 sm:mb-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3" dir="ltr">
            <div dir={dir}>
              <label className="theme-muted mb-1 block text-[11px]">
                {t("common.homeTeam")}
              </label>
              <input
                type="text"
                value={editHomeTeam}
                onChange={(event) => setEditHomeTeam(event.target.value)}
                className="theme-input w-full rounded-xl border px-3 py-3 text-center text-sm font-bold outline-none focus:border-green-400 sm:text-base"
              />
            </div>

            <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-400/10 text-[10px] font-black text-yellow-300 sm:h-11 sm:w-11">
              {t("admin.against")}
            </div>

            <div dir={dir}>
              <label className="theme-muted mb-1 block text-[11px]">
                {t("common.awayTeam")}
              </label>
              <input
                type="text"
                value={editAwayTeam}
                onChange={(event) => setEditAwayTeam(event.target.value)}
                className="theme-input w-full rounded-xl border px-3 py-3 text-center text-sm font-bold outline-none focus:border-green-400 sm:text-base"
              />
            </div>
          </div>

          <div>
            <label className="theme-muted mb-1 block text-[11px]">
              {t("admin.dateTime")}
            </label>
            <input
              type="datetime-local"
              value={editStartTime}
              onChange={(event) => setEditStartTime(event.target.value)}
              className="theme-input w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-green-400 sm:text-base"
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
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green-950/40 transition hover:scale-[1.02]"
            >
              {t("admin.saveEdit")}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditHomeTeam(match.home_team);
                setEditAwayTeam(match.away_team);
                setEditStartTime(formatDateTimeForInput(match.start_time));
                setIsEditing(false);
              }}
              className="theme-neutral-button rounded-xl border px-4 py-3 text-sm font-bold transition"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2" dir="ltr">
        <input
          type="number"
          min="0"
          value={homeScore}
          onChange={(event) => setHomeScore(event.target.value)}
          placeholder={t("common.homeTeam")}
          className="theme-input w-full rounded-xl border px-3 py-3 text-center text-lg font-black outline-none transition focus:border-green-400 sm:text-xl"
        />

        <input
          type="number"
          min="0"
          value={awayScore}
          onChange={(event) => setAwayScore(event.target.value)}
          placeholder={t("common.awayTeam")}
          className="theme-input w-full rounded-xl border px-3 py-3 text-center text-lg font-black outline-none transition focus:border-green-400 sm:text-xl"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onUpdateScore(match.id, homeScore, awayScore)}
          className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-green-950/40 transition hover:scale-[1.02]"
        >
          {t("admin.updateResult")}
        </button>

        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="rounded-xl border border-white/10 bg-blue-600/80 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-600"
        >
          {isEditing ? t("admin.closeEdit") : t("admin.editMatch")}
        </button>

        <button
          type="button"
          onClick={() => onDeleteMatch(match.id)}
          className="rounded-xl border border-red-400/20 bg-red-600/80 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600"
        >
          {t("admin.deleteMatch")}
        </button>
      </div>
    </div>
  );
}
