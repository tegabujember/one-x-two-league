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

export default function LeagueAdminPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const code = String(params.code).toUpperCase();

  const [league, setLeague] = useState<League | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [startTime, setStartTime] = useState("");

  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [predictionPlayerId, setPredictionPlayerId] = useState("");
  const [predictionImportText, setPredictionImportText] = useState("");
  const [isImportingPredictions, setIsImportingPredictions] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  function getToastTypeFromMessage(message: string): ToastType {
  if (
    message.includes("בהצלחה") ||
    message.includes("עודכנה") ||
    message.includes("נוסף") ||
    message.includes("נמחק") ||
    message.includes("יובאו") ||
    message.includes("נפתחו") ||
    message.includes("ננעלו")
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
    message.includes("חסרה")
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

    const isGoogleOwner =
      Boolean(user?.id) &&
      Boolean(leagueData.owner_id) &&
      user?.id === leagueData.owner_id;

    const isLegacyAdmin =
      Boolean(leagueData.admin_code) &&
      Boolean(savedAdminCode) &&
      savedAdminCode === leagueData.admin_code;

    if (!isGoogleOwner && !isLegacyAdmin) {
      alert("אין לך הרשאת מנהל לליגה הזאת");
      router.replace(`/league/${code}`);
      return;
    }

    if (user?.email) {
      setAdminEmail(user.email);
    }

    setLeague(leagueData);

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
        alert("צריך להתחבר עם Google כדי להוסיף משחק");
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

    const shouldImport = confirm(
      `נמצאו ${parsedMatches.length} משחקים. לייבא אותם לליגה?`
    );

    if (!shouldImport) {
      return;
    }

    setIsImporting(true);

    const response = await fetch(`/api/leagues/${code}/matches/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        matches: parsedMatches,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר עם Google כדי לייבא משחקים");
      } else if (response.status === 403) {
        alert("אין לך הרשאה לייבא משחקים לליגה הזאת");
      } else {
        alert("שגיאה בייבוא המשחקים");
      }

      setIsImporting(false);
      return;
    }

    const data = await response.json();

    setImportText("");
    setIsImporting(false);

    await loadLeagueAndMatches();

    alert(
      `יובאו ${data.imported} משחקים בהצלחה.\nהסתיימו: ${
        data.finished ?? 0
      }\nעתידיים: ${data.upcoming ?? 0}`
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
        alert("צריך להתחבר עם Google כדי לייבא ניחושים");
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
        key.startsWith("selected-player-") ||
        key.startsWith("league-admin-")
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
        alert("צריך להתחבר עם Google");
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
        alert("צריך להתחבר עם Google כדי לעדכן תוצאה");
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
        alert("צריך להתחבר עם Google כדי לערוך משחק");
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
        alert("צריך להתחבר עם Google כדי למחוק משחק");
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
                  קוד ליגה:{" "}
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
                    מצב ניחושים:{" "}
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
            <h2 className="text-xl font-black sm:text-2xl">
              ייבוא משחקים מרשימה
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              הדבק משחקים בפורמט הבא. אפשר להדביק משחקים בלי תוצאה או משחקים עם
              תוצאה.
            </p>

            <div className="mt-3 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-xs leading-6 text-yellow-100">
              <p>2026-06-11 22:00 | Mexico | South Africa | 2-0</p>
              <p>2026-06-12 05:00 | South Korea | Czechia | 2-1</p>
              <p>2026-06-17 20:00 | Portugal | DR Congo</p>
            </div>
          </div>

          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={`2026-06-11 22:00 | Mexico | South Africa | 2-0
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
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-black sm:text-2xl">
              ייבוא ניחושים לשחקן
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              בחר שחקן והדבק ניחושים. אם לשחקן כבר יש ניחוש לאותו משחק, לא
              נדרוס אותו.
            </p>

            <div className="mt-3 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-xs leading-6 text-yellow-100">
              <p>2026-06-11 22:00 | Mexico | South Africa | 1</p>
              <p>2026-06-12 19:00 | Argentina | Spain | X</p>
              <p>2026-06-12 22:00 | France | Germany | 2</p>
            </div>
          </div>

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
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex items-center justify-between sm:mb-5">
            <h2 className="text-xl font-black sm:text-2xl">ניהול משחקים</h2>

            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-400 sm:px-4 sm:py-2 sm:text-xs">
              {matches.length} משחקים
            </span>
          </div>

          {matches.length === 0 ? (
            <p className="text-sm text-slate-400">עדיין אין משחקים לעדכן.</p>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {matches.map((match) => (
                <MatchAdminCard
                  key={match.id}
                  match={match}
                  onUpdateScore={updateScore}
                  onUpdateMatch={updateMatchDetails}
                  onDeleteMatch={deleteMatch}
                />
              ))}
            </div>
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