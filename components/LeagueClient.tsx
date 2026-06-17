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

  const selectedPlayerStorageKey = `selected-player-${league.code}`;
  const adminStorageKey = `league-admin-${league.code}`;

  useEffect(() => {
    async function loadUserAndLocalState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const savedPlayerId = localStorage.getItem(selectedPlayerStorageKey);

      if (savedPlayerId) {
        const playerExists = players.some(
          (player) => player.id === savedPlayerId
        );

        if (playerExists) {
          setSelectedPlayerId(savedPlayerId);
        }
      } else if (user?.id) {
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

      const savedAdminCode = localStorage.getItem(adminStorageKey);

      const isGoogleOwner =
        Boolean(user?.id) && Boolean(league.owner_id) && user?.id === league.owner_id;

      const isLegacyAdmin =
        Boolean(savedAdminCode) &&
        Boolean(league.admin_code) &&
        savedAdminCode === league.admin_code;

      if (isGoogleOwner || isLegacyAdmin) {
        setIsAdmin(true);
      }
    }

    loadUserAndLocalState();
  }, [
    players,
    supabase,
    selectedPlayerStorageKey,
    adminStorageKey,
    league.admin_code,
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

  function getFeaturedMatchLabel(match: Match) {
    if (showAllMatches) return null;

    if (lastMatch && match.id === lastMatch.id) return "משחק אחרון";
    if (currentMatch && match.id === currentMatch.id) return "משחק קרוב";
    if (nextMatch && match.id === nextMatch.id) return "משחק הבא";

    return null;
  }

 async function savePrediction(matchId: string, pick: "1" | "X" | "2") {
  if (!selectedPlayerId) {
    alert("כדי לשלוח ניחוש צריך קודם להצטרף לליגה");
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
      alert("אין לך הרשאה לשלוח את הניחוש הזה או שהמשחק כבר נסגר");
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

  function handleAdminLogin() {
    if (!league.admin_code) {
      alert(
        "לליגה הזאת אין קוד מנהל. כנראה היא נוצרה לפני שהוספנו את הפיצ׳ר הזה."
      );
      return;
    }

    const codeFromUser = prompt("הכנס קוד מנהל");

    if (!codeFromUser) return;

    if (codeFromUser.trim() !== league.admin_code) {
      alert("קוד מנהל שגוי");
      return;
    }

    localStorage.setItem(adminStorageKey, league.admin_code);
    setIsAdmin(true);
    alert("נכנסת כמנהל");
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

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative px-3 py-5 sm:px-4 sm:py-8">
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
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3">
            {isAdmin ? (
              <Link
                href={`/league/${league.code}/admin`}
                className="block rounded-xl bg-gradient-to-r from-blue-500 to-indigo-700 px-4 py-3 text-center text-sm font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
              >
                ניהול ליגה
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAdminLogin}
                className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-700 px-4 py-3 text-center text-sm font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
              >
                כניסת מנהל
              </button>
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
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-center text-sm font-bold text-slate-100 transition hover:bg-slate-800 sm:col-span-2 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
            >
              העתק לינק להזמנה
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
          {selectedPlayer ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="mb-1 text-xs text-slate-400 sm:text-sm">
                  מחובר כשחקן
                </p>
                <p className="text-xl font-black sm:text-2xl">
                  {selectedPlayer.name}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-green-400/20 bg-green-500/20 sm:h-14 sm:w-14 sm:rounded-2xl">
                <span className="text-xl sm:text-2xl">⚽</span>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="mb-2 text-xl font-black sm:text-2xl">
                עדיין לא הצטרפת לליגה
              </h2>

              <p className="mb-4 text-sm leading-6 text-slate-400 sm:mb-5">
                כדי לשלוח ניחושים צריך להצטרף עם שם שחקן.
              </p>

              <Link
                href={`/join-league?code=${league.code}`}
                className="block rounded-xl bg-gradient-to-r from-green-500 to-emerald-700 px-4 py-3 text-center text-sm font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] sm:rounded-2xl sm:px-5 sm:py-4 sm:text-base"
              >
                הצטרף לליגה הזאת
              </Link>
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 border-t border-white/10 pt-4 sm:mt-6 sm:pt-5">
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
                  const isMatchLocked =
                    new Date(match.start_time) <= new Date();
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

                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {(["1", "X", "2"] as const).map((pick) => {
                          const isSelected = currentPrediction?.pick === pick;
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
                              disabled={
                                isSaving || !selectedPlayerId || isMatchLocked
                              }
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

                      {matchResult && (
                        <p className="mt-2 text-center text-xs text-slate-300">
                          תוצאה נכונה לניחוש: {matchResult}
                        </p>
                      )}

                      {isMatchLocked && (
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