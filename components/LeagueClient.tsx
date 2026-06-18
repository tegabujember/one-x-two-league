"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";

type Player = {
  id: string;
  name: string;
  user_id: string | null;
};

type Match = {
  id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

type League = {
  id: string;
  name: string;
  code: string;
  admin_code: string | null;
  owner_id: string | null;
  predictions_locked: boolean;
};

type Prediction = {
  id: string;
  match_id: string;
  player_id: string;
  pick: string;
};

type LeagueClientProps = {
  league: League;
  players: Player[];
  matches: Match[];
  predictions: Prediction[];
};

function getMatchResult(match: Match): "1" | "X" | "2" | null {
  if (
    match.status !== "finished" ||
    match.home_score === null ||
    match.away_score === null
  ) {
    return null;
  }

  if (match.home_score > match.away_score) return "1";
  if (match.home_score < match.away_score) return "2";

  return "X";
}

function getRankIcon(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}`;
}

export default function LeagueClient({
  league,
  players,
  matches,
  predictions,
}: LeagueClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [localPredictions, setLocalPredictions] = useState(predictions);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const selectedPlayerStorageKey = `selected-player-${league.code}`;

  useEffect(() => {
    async function loadUserAndLocalState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAuthEmail("");
        setSelectedPlayerId("");
        setIsAdmin(false);
        localStorage.removeItem(selectedPlayerStorageKey);
        localStorage.removeItem(`league-admin-${league.code}`);
        return;
      }

      setAuthEmail(user.email || "");

      const savedPlayerId = localStorage.getItem(selectedPlayerStorageKey);

      if (savedPlayerId) {
        const playerExists = players.some(
          (player) => player.id === savedPlayerId
        );

        if (playerExists) {
          setSelectedPlayerId(savedPlayerId);
        }
      } else if (user.id) {
        const playerByGoogleUser = players.find(
          (player) => player.user_id === user.id
        );

        if (playerByGoogleUser) {
          setSelectedPlayerId(playerByGoogleUser.id);
          localStorage.setItem(
            selectedPlayerStorageKey,
            playerByGoogleUser.id
          );
        }
      }

      const isGoogleOwner =
        Boolean(user.id) &&
        Boolean(league.owner_id) &&
        user.id === league.owner_id;

      setIsAdmin(isGoogleOwner);
    }

    loadUserAndLocalState();
  }, [
    players,
    supabase,
    selectedPlayerStorageKey,
    league.code,
    league.owner_id,
  ]);

  const selectedPlayer = players.find(
    (player) => player.id === selectedPlayerId
  );

  const finishedMatches = matches.filter(
    (match) => getMatchResult(match) !== null
  );

  function getPredictionForMatch(matchId: string, playerId = selectedPlayerId) {
    return localPredictions.find(
      (prediction) =>
        prediction.match_id === matchId && prediction.player_id === playerId
    );
  }

  function getPlayerStats(playerId: string) {
    let points = 0;
    let guessed = 0;

    for (const match of finishedMatches) {
      const result = getMatchResult(match);
      const prediction = getPredictionForMatch(match.id, playerId);

      if (!prediction || !result) continue;

      guessed += 1;

      if (prediction.pick === result) {
        points += 1;
      }
    }

    return {
      points,
      guessed,
      totalFinished: finishedMatches.length,
    };
  }

  const rankedPlayers = [...players].sort((a, b) => {
    const statsA = getPlayerStats(a.id);
    const statsB = getPlayerStats(b.id);

    return statsB.points - statsA.points;
  });

  const now = new Date();

  const sortedMatches = [...matches].sort(
    (a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const pastMatches = sortedMatches.filter(
    (match) => new Date(match.start_time) <= now
  );

  const futureMatches = sortedMatches.filter(
    (match) => new Date(match.start_time) > now
  );

  const lastMatch = pastMatches[pastMatches.length - 1];
  const currentMatch = futureMatches[0];
  const nextMatch = futureMatches[1];

  const featuredMatches = [lastMatch, currentMatch, nextMatch].filter(
    (match): match is Match => Boolean(match)
  );

  const matchesToShow = showAllMatches ? sortedMatches : featuredMatches;

  const selectedPlayerPredictions = selectedPlayer
    ? localPredictions.filter(
        (prediction) => prediction.player_id === selectedPlayer.id
      )
    : [];

  const selectedPlayerPredictionMatchIds = new Set(
    selectedPlayerPredictions.map((prediction) => prediction.match_id)
  );

  const openMatches = matches.filter(
    (match) =>
      new Date(match.start_time) > now &&
      !league.predictions_locked &&
      match.status !== "finished"
  );

  const missingOpenMatches = openMatches.filter(
    (match) => !selectedPlayerPredictionMatchIds.has(match.id)
  );

  const closedMatches = matches.filter(
    (match) =>
      new Date(match.start_time) <= now ||
      league.predictions_locked ||
      match.status === "finished"
  );

  const correctPredictions = selectedPlayerPredictions.filter((prediction) => {
    const match = matches.find(
      (currentMatch) => currentMatch.id === prediction.match_id
    );
    const result = match ? getMatchResult(match) : null;

    return result !== null && prediction.pick === result;
  });

  const wrongPredictions = selectedPlayerPredictions.filter((prediction) => {
    const match = matches.find(
      (currentMatch) => currentMatch.id === prediction.match_id
    );
    const result = match ? getMatchResult(match) : null;

    return result !== null && prediction.pick !== result;
  });

  const pendingPredictions = selectedPlayerPredictions.filter((prediction) => {
    const match = matches.find(
      (currentMatch) => currentMatch.id === prediction.match_id
    );
    const result = match ? getMatchResult(match) : null;

    return result === null;
  });

  const finishedPredictionsCount =
    correctPredictions.length + wrongPredictions.length;

  const predictionAccuracy =
    finishedPredictionsCount > 0
      ? Math.round((correctPredictions.length / finishedPredictionsCount) * 100)
      : 0;

  const predictionProgress =
    matches.length > 0
      ? Math.round((selectedPlayerPredictionMatchIds.size / matches.length) * 100)
      : 0;

  const myPredictionRows = selectedPlayerPredictions
    .map((prediction) => ({
      prediction,
      match: matches.find((match) => match.id === prediction.match_id),
    }))
    .filter(
      (
        row
      ): row is {
        prediction: Prediction;
        match: Match;
      } => Boolean(row.match)
    )
    .sort(
      (a, b) =>
        new Date(a.match.start_time).getTime() -
        new Date(b.match.start_time).getTime()
    );

  function getFeaturedMatchLabel(match: Match) {
    if (showAllMatches) return null;

    if (lastMatch && match.id === lastMatch.id) return "משחק אחרון";
    if (currentMatch && match.id === currentMatch.id) return "משחק קרוב";
    if (nextMatch && match.id === nextMatch.id) return "משחק הבא";

    return null;
  }

  async function savePrediction(matchId: string, pick: "1" | "X" | "2") {
    if (!authEmail) {
      alert("צריך להתחבר עם Google כדי לשלוח ניחוש");
      return;
    }

    if (!selectedPlayerId) {
      alert("כדי לשלוח ניחוש צריך קודם להצטרף לליגה");
      return;
    }

    if (league.predictions_locked) {
      alert("הניחושים נסגרו על ידי מנהל הליגה");
      return;
    }

    setIsSaving(true);

    const response = await fetch(`/api/leagues/${league.code}/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        match_id: matchId,
        player_id: selectedPlayerId,
        pick,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר עם Google כדי לשלוח ניחוש");
      } else if (response.status === 403) {
        if (errorData?.error === "League predictions are locked") {
          alert("הניחושים נסגרו על ידי מנהל הליגה");
        } else {
          alert("אין לך הרשאה לשלוח את הניחוש הזה או שהמשחק כבר נסגר");
        }
      } else {
        alert("שגיאה בשמירת הניחוש");
      }

      setIsSaving(false);
      return;
    }

    const data = await response.json();
    const savedPrediction = data.prediction as Prediction;

    setLocalPredictions((current) => {
      const existingPrediction = current.find(
        (prediction) =>
          prediction.match_id === savedPrediction.match_id &&
          prediction.player_id === savedPrediction.player_id
      );

      if (existingPrediction) {
        return current.map((prediction) =>
          prediction.match_id === savedPrediction.match_id &&
          prediction.player_id === savedPrediction.player_id
            ? savedPrediction
            : prediction
        );
      }

      return [...current, savedPrediction];
    });

    setIsSaving(false);
  }

  function handlePlayerChange(playerId: string) {
    setSelectedPlayerId(playerId);

    if (playerId) {
      localStorage.setItem(selectedPlayerStorageKey, playerId);
    } else {
      localStorage.removeItem(selectedPlayerStorageKey);
    }
  }

  async function copyLeagueLink() {
    const leagueUrl = `${window.location.origin}/league/${league.code}`;

    try {
      await navigator.clipboard.writeText(leagueUrl);
      alert("הלינק הועתק");
    } catch (error) {
      console.error(error);
      alert("לא הצלחתי להעתיק את הלינק");
    }
  }

  function shareOnWhatsApp() {
    const leagueUrl = `${window.location.origin}/league/${league.code}`;

    const message = `הצטרף לליגת הניחושים שלי:
${league.name}
${leagueUrl}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, "_blank");
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

    localStorage.removeItem(selectedPlayerStorageKey);
    localStorage.removeItem(`league-admin-${league.code}`);

    setSelectedPlayerId("");
    setIsAdmin(false);
    setAuthEmail("");
    setIsAccountMenuOpen(false);
    setIsSigningOut(false);

    window.location.href = "/";
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative px-3 py-5 sm:px-4 sm:py-8">
      {authEmail && (
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
                {authEmail}
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
            <span className="text-2xl sm:text-3xl">🏆</span>
          </div>

          <p className="text-[10px] font-semibold tracking-[0.28em] text-green-300 sm:text-xs sm:tracking-[0.35em]">
            WORLD CUP LEAGUE
          </p>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
          <div className="text-center">
            <p className="mb-1 text-xs text-slate-400 sm:text-sm">ליגה</p>

            <h1 className="text-2xl font-black tracking-tight sm:text-4xl">
              {league.name}
            </h1>

            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 sm:mt-5 sm:rounded-2xl sm:px-5 sm:py-3">
              <span className="text-xs text-slate-400 sm:text-sm">קוד</span>
              <span className="text-xl font-black tracking-widest text-green-300 sm:text-2xl">
                {league.code}
              </span>
            </div>

            {league.predictions_locked && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                🔒 הניחושים נסגרו על ידי מנהל הליגה
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3">
            {isAdmin && (
              <Link
                href={`/league/${league.code}/admin`}
                className="block rounded-xl bg-gradient-to-r from-blue-500 to-indigo-700 px-4 py-3 text-center text-sm font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 sm:col-span-2 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
              >
                ניהול ליגה
              </Link>
            )}

            <button
              type="button"
              onClick={shareOnWhatsApp}
              className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-4 py-3 text-center text-sm font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
            >
              שתף בוואטסאפ
            </button>

            <button
              type="button"
              onClick={copyLeagueLink}
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-center text-sm font-bold text-slate-100 transition hover:bg-slate-800 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
            >
              העתק לינק להזמנה
            </button>
          </div>
        </div>

        {selectedPlayer && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black sm:text-3xl">
                  הניחושים שלי
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  המעקב האישי שלך אחרי הניחושים במשחקים
                </p>
              </div>

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-green-400/20 bg-green-500/10 text-3xl shadow-lg shadow-green-950/30">
                🎯
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-[11px] font-bold text-slate-400">
                    סה״כ משחקים
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {matches.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-3 text-center">
                  <p className="text-[11px] font-bold text-slate-400">
                    ניחשתי
                  </p>
                  <p className="mt-2 text-3xl font-black text-green-300">
                    {selectedPlayerPredictionMatchIds.size}
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-3 text-center">
                  <p className="text-[11px] font-bold text-slate-400">
                    נותרו פתוחים
                  </p>
                  <p className="mt-2 text-3xl font-black text-orange-300">
                    {missingOpenMatches.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-center">
                  <p className="text-[11px] font-bold text-slate-400">
                    דיוק נוכחי
                  </p>
                  <p className="mt-2 text-3xl font-black text-green-300">
                    {predictionAccuracy}%
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-300">התקדמות</span>
                  <span className="font-black text-green-300">
                    {selectedPlayerPredictionMatchIds.size} מתוך {matches.length}
                  </span>
                </div>

                <div className="h-4 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all"
                    style={{ width: `${predictionProgress}%` }}
                  />
                </div>

                <p className="mt-2 text-xs font-bold text-green-300">
                  {predictionProgress}% הושלמו
                </p>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-full border border-green-400/20 bg-green-500/10 px-3 py-3 text-center text-sm font-black text-green-300">
                ✅ נכונים ({correctPredictions.length})
              </div>

              <div className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-3 text-center text-sm font-black text-red-300">
                ❌ שגויים ({wrongPredictions.length})
              </div>

              <div className="rounded-full border border-slate-400/20 bg-slate-500/10 px-3 py-3 text-center text-sm font-black text-slate-300">
                🕒 טרם התקיימו ({pendingPredictions.length})
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-black text-white">
                הכל ({selectedPlayerPredictionMatchIds.size})
              </div>
            </div>

            {myPredictionRows.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-center">
                <p className="text-sm font-bold text-slate-300">
                  עדיין לא סימנת ניחושים.
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  גלול למטה למשחקים ובחר 1 / X / 2.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myPredictionRows.slice(0, 3).map(({ prediction, match }) => {
                  const matchResult = getMatchResult(match);
                  const isCorrect =
                    matchResult !== null && prediction.pick === matchResult;
                  const isWrong =
                    matchResult !== null && prediction.pick !== matchResult;

                  const statusLabel =
                    matchResult === null
                      ? "טרם התקיים"
                      : isCorrect
                        ? "נכון"
                        : "שגוי";

                  const pickLabel =
                    prediction.pick === "1"
                      ? match.home_team
                      : prediction.pick === "2"
                        ? match.away_team
                        : "תיקו";

                  return (
                    <div
                      key={prediction.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-400">
                            {new Date(match.start_time).toLocaleString("he-IL")}
                          </p>

                          <p className="mt-1 text-sm font-black text-white sm:text-base">
                            {match.home_team} נגד {match.away_team}
                          </p>
                        </div>

                        <span
                          className={`rounded-xl px-3 py-2 text-xs font-black ${
                            isCorrect
                              ? "border border-green-400/20 bg-green-500/10 text-green-300"
                              : isWrong
                                ? "border border-red-400/20 bg-red-500/10 text-red-300"
                                : "border border-slate-400/20 bg-slate-500/10 text-slate-300"
                          }`}
                        >
                          {isCorrect && "✅ "}
                          {isWrong && "❌ "}
                          {!isCorrect && !isWrong && "🕒 "}
                          {statusLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 items-center gap-2 text-center">
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                          <p className="text-[10px] text-slate-500">בית</p>
                          <p className="mt-1 truncate text-sm font-black">
                            {match.home_team}
                          </p>
                        </div>

                        <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 p-3">
                          <p className="text-[10px] text-slate-400">
                            הניחוש שלי
                          </p>
                          <p className="mt-1 text-2xl font-black text-yellow-300">
                            {prediction.pick}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">
                            {pickLabel}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                          <p className="text-[10px] text-slate-500">חוץ</p>
                          <p className="mt-1 truncate text-sm font-black">
                            {match.away_team}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-center text-xs text-slate-400">
                        תוצאה:{" "}
                        <span className="font-black text-white">
                          {match.status === "finished"
                            ? `${match.home_score} - ${match.away_score}`
                            : "-"}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {myPredictionRows.length > 3 && (
              <p className="mt-3 text-center text-xs text-slate-400">
                מוצגים 3 ניחושים ראשונים מתוך {myPredictionRows.length}.
                כל השאר מופיעים באזור המשחקים.
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowAllMatches(true)}
              className="mt-5 w-full rounded-2xl border border-green-400/30 bg-green-500/10 px-5 py-4 text-center text-sm font-black text-green-300 transition hover:bg-green-500/20"
            >
              צפה בכל המשחקים והניחושים שלי
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              סגורים: {closedMatches.length} | פתוחים: {openMatches.length}
            </p>
          </div>
        )}

        {(!selectedPlayer || isAdmin) && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
            {!selectedPlayer && (
              <div>
                <h2 className="mb-2 text-xl font-black sm:text-2xl">
                  עדיין לא הצטרפת לליגה
                </h2>

                <p className="mb-4 text-sm leading-6 text-slate-400 sm:mb-5">
                  כדי לשלוח ניחושים צריך להתחבר ולהצטרף עם שם שחקן.
                </p>

                <Link
                  href={`/login?next=${encodeURIComponent(
                    `/join-league?code=${league.code}`
                  )}`}
                  onClick={() => {
                    localStorage.setItem(
                      "redirect-after-login",
                      `/join-league?code=${league.code}`
                    );
                  }}
                  className="block rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 text-center font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600"
                >
                  התחבר / הצטרף לליגה הזאת
                </Link>

                <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                  אם כבר הצטרפת בעבר, נחבר אותך אוטומטית לשחקן הקיים שלך.
                </p>
              </div>
            )}

            {isAdmin && (
              <div
                className={
                  !selectedPlayer
                    ? "mt-4 border-t border-white/10 pt-4 sm:mt-6 sm:pt-5"
                    : ""
                }
              >
                <h2 className="mb-2 text-base font-bold sm:mb-3 sm:text-lg">
                  בחירת שחקן לאדמין
                </h2>

                <select
                  value={selectedPlayerId}
                  onChange={(event) => handlePlayerChange(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-green-400 sm:rounded-2xl sm:py-4 sm:text-base"
                >
                  <option value="">בחר שחקן</option>

                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-slate-400 sm:mt-3">
                  האפשרות הזאת מוצגת רק למנהל.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex items-center justify-between sm:mb-5">
            <h2 className="text-xl font-black sm:text-2xl">טבלת דירוג</h2>

            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-400 sm:px-4 sm:py-2 sm:text-xs">
              {players.length} שחקנים
            </span>
          </div>

          {rankedPlayers.length === 0 ? (
            <p className="text-sm text-slate-400">עדיין אין שחקנים.</p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {rankedPlayers.map((player, index) => {
                const stats = getPlayerStats(player.id);
                const isCurrentPlayer = player.id === selectedPlayerId;

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between rounded-xl border px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4 ${
                      isCurrentPlayer
                        ? "border-green-400/30 bg-green-500/10"
                        : "border-white/10 bg-slate-950/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-sm font-black sm:h-11 sm:w-11 sm:rounded-2xl sm:text-base">
                        {getRankIcon(index)}
                      </div>

                      <div>
                        <p className="text-sm font-bold sm:text-base">
                          {player.name}
                          {isCurrentPlayer && (
                            <span className="mr-2 text-[11px] text-green-300 sm:text-xs">
                              אתה
                            </span>
                          )}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                          פגיעות: {stats.points}/{stats.totalFinished}
                        </p>
                      </div>
                    </div>

                    <div className="text-left">
                      <p className="text-xl font-black text-green-300 sm:text-2xl">
                        {stats.points}
                      </p>
                      <p className="text-[10px] text-slate-500 sm:text-xs">
                        נק׳
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex items-center justify-between sm:mb-5">
            <h2 className="text-xl font-black sm:text-2xl">
              משחקים וניחושים
            </h2>

            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-400 sm:px-4 sm:py-2 sm:text-xs">
              {showAllMatches ? matches.length : matchesToShow.length} מוצגים
            </span>
          </div>

          {matches.length === 0 ? (
            <p className="text-sm text-slate-400">
              עדיין לא נוספו משחקים. אפשר להוסיף דרך ניהול ליגה.
            </p>
          ) : (
            <>
              <div className="space-y-3 sm:space-y-4">
                {matchesToShow.map((match) => {
                  const currentPrediction = getPredictionForMatch(match.id);
                  const isTimeLocked =
                    new Date(match.start_time) <= new Date();
                  const isMatchLocked =
                    league.predictions_locked || isTimeLocked;
                  const matchResult = getMatchResult(match);
                  const featuredLabel = getFeaturedMatchLabel(match);

                  return (
                    <div
                      key={match.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:rounded-3xl sm:p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {featuredLabel && (
                            <span className="rounded-full border border-yellow-300/20 bg-yellow-400/10 px-2 py-1 text-[11px] font-bold text-yellow-300 sm:px-3 sm:text-xs">
                              {featuredLabel}
                            </span>
                          )}

                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-bold sm:px-3 sm:text-xs ${
                              match.status === "finished"
                                ? "bg-green-500/20 text-green-300"
                                : isMatchLocked
                                  ? "bg-red-500/20 text-red-300"
                                  : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {match.status === "finished"
                              ? "הסתיים"
                              : isMatchLocked
                                ? "סגור"
                                : "פתוח"}
                          </span>
                        </div>

                        <div className="min-w-16 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-center sm:min-w-20 sm:rounded-2xl sm:px-4">
                          <p className="text-[10px] text-slate-500 sm:text-xs">
                            תוצאה
                          </p>
                          <p className="text-lg font-black sm:text-xl">
                            {match.status === "finished"
                              ? `${match.home_score} - ${match.away_score}`
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:mb-4 sm:gap-3">
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2 text-center sm:rounded-2xl sm:p-4">
                          <p className="mb-1 text-[10px] text-slate-500 sm:text-xs">
                            בית
                          </p>
                          <p className="truncate text-base font-black sm:text-2xl">
                            {match.home_team}
                          </p>
                        </div>

                        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-yellow-300/20 bg-yellow-400/10 text-xs font-black text-yellow-300 sm:h-12 sm:w-12 sm:text-base">
                          VS
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

                      {!authEmail || !selectedPlayer ? null : (
                        <>
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {(["1", "X", "2"] as const).map((pick) => {
                              const isSelected =
                                currentPrediction?.pick === pick;
                              const isCorrect =
                                matchResult !== null &&
                                isSelected &&
                                pick === matchResult;
                              const isWrong =
                                matchResult !== null &&
                                isSelected &&
                                pick !== matchResult;

                              const pickLabel =
                                pick === "1"
                                  ? match.home_team
                                  : pick === "2"
                                    ? match.away_team
                                    : "תיקו";

                              return (
                                <button
                                  key={pick}
                                  type="button"
                                  disabled={isSaving || isMatchLocked}
                                  onClick={() => savePrediction(match.id, pick)}
                                  className={`rounded-xl border px-1 py-2 font-black transition sm:rounded-2xl sm:px-2 sm:py-4 ${
                                    isCorrect
                                      ? "border-green-400 bg-green-600 text-white"
                                      : isWrong
                                        ? "border-red-500 bg-red-700 text-white"
                                        : isSelected
                                          ? "border-blue-400 bg-blue-600 text-white"
                                          : "border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800"
                                  } disabled:opacity-40`}
                                >
                                  <span className="block text-2xl sm:text-3xl">
                                    {pick}
                                    {isCorrect && " ✅"}
                                    {isWrong && " ❌"}
                                  </span>

                                  <span className="mt-1 block truncate text-[10px] font-semibold text-slate-300 sm:mt-2 sm:text-xs">
                                    {pickLabel}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {currentPrediction && (
                            <p className="mt-3 text-center text-xs text-slate-400">
                              הניחוש שלך:{" "}
                              <span className="font-bold text-white">
                                {currentPrediction.pick}
                              </span>
                            </p>
                          )}
                        </>
                      )}

                      {matchResult && (
                        <p className="mt-2 text-center text-xs text-slate-300">
                          תוצאה נכונה לניחוש: {matchResult}
                        </p>
                      )}

                      {league.predictions_locked &&
                        match.status !== "finished" && (
                          <p className="mt-2 text-center text-xs text-red-300">
                            הניחושים נסגרו על ידי מנהל הליגה
                          </p>
                        )}

                      {!league.predictions_locked && isTimeLocked && (
                        <p className="mt-2 text-center text-xs text-red-300">
                          הניחוש למשחק הזה נסגר
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {matches.length > featuredMatches.length && (
                <button
                  type="button"
                  onClick={() => setShowAllMatches((current) => !current)}
                  className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-center text-sm font-bold text-slate-100 transition hover:bg-slate-800 sm:mt-5 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
                >
                  {showAllMatches
                    ? "הצג פחות משחקים"
                    : "הצג את כל המשחקים"}
                </button>
              )}
            </>
          )}
        </div>

        <Link
          href="/"
          className="mt-5 block text-center text-xs text-slate-400 hover:text-white sm:mt-6 sm:text-sm"
        >
          צור / הצטרף לליגה אחרת
        </Link>
      </div>
    </main>
  );
}