"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import UserMenu from "@/components/auth/UserMenu";

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
  admin_edit_mode: boolean;
};

type Prediction = {
  id: string;
  match_id: string;
  player_id: string;
  pick: string;
};

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  message: string;
  type: ToastType;
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

function RankShield({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-xl font-black text-white sm:h-16 sm:w-16 sm:text-2xl">
        {rank}
      </div>
    );
  }

  const theme =
    rank === 1
      ? {
          main: "#facc15",
          light: "#fef08a",
          dark: "#92400e",
          glow: "drop-shadow-[0_0_16px_rgba(250,204,21,0.48)]",
          crown: true,
        }
      : rank === 2
        ? {
            main: "#cbd5e1",
            light: "#f8fafc",
            dark: "#475569",
            glow: "drop-shadow-[0_0_13px_rgba(226,232,240,0.28)]",
            crown: false,
          }
        : {
            main: "#fb923c",
            light: "#fed7aa",
            dark: "#9a3412",
            glow: "drop-shadow-[0_0_13px_rgba(251,146,60,0.30)]",
            crown: false,
          };

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${
        rank === 1
          ? "h-[78px] w-[78px] sm:h-[94px] sm:w-[94px]"
          : "h-[66px] w-[66px] sm:h-[78px] sm:w-[78px]"
      } ${theme.glow}`}
    >
      {theme.crown && (
        <svg
          viewBox="0 0 120 60"
          aria-hidden="true"
          className="absolute -top-5 left-1/2 z-20 h-11 w-16 -translate-x-1/2 sm:-top-6 sm:h-12 sm:w-[72px]"
        >
          <defs>
            <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>
          </defs>

          <path
            d="M14 43 20 12l20 19L60 5l20 26 20-19 6 31H14Z"
            fill="url(#crownGold)"
            stroke="#fff7b0"
            strokeWidth="3"
          />
          <path
            d="M16 43h88l-7 11H23l-7-11Z"
            fill="#a16207"
            stroke="#fde68a"
            strokeWidth="2"
          />
          <circle cx="38" cy="37" r="4" fill="#22c55e" />
          <circle cx="60" cy="29" r="4.5" fill="#ef4444" />
          <circle cx="82" cy="37" r="4" fill="#3b82f6" />
        </svg>
      )}

      <svg
        viewBox="0 0 120 140"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={`shield-${rank}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.light} />
            <stop offset="38%" stopColor={theme.main} />
            <stop offset="100%" stopColor={theme.dark} />
          </linearGradient>

          <filter id={`shadow-${rank}`}>
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.45" />
          </filter>
        </defs>

        <path
          d="M18 18h84l10 13v55c0 20-17 37-52 49C25 123 8 106 8 86V31l10-13Z"
          fill={`url(#shield-${rank})`}
          stroke={theme.light}
          strokeWidth="3"
          filter={`url(#shadow-${rank})`}
        />

        <path
          d="M25 26h70l7 10v46c0 16-14 30-42 40-28-10-42-24-42-40V36l7-10Z"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />

        <path
          d="M17 61C5 70 5 91 17 102"
          fill="none"
          stroke={theme.light}
          strokeWidth="3"
          opacity="0.75"
        />
        <path
          d="M103 61c12 9 12 30 0 41"
          fill="none"
          stroke={theme.light}
          strokeWidth="3"
          opacity="0.75"
        />
      </svg>

      <span
        className="relative z-10 mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl"
        style={{
          textShadow: "0 2px 0 rgba(255,255,255,0.45)",
        }}
      >
        {rank}
      </span>
    </div>
  );
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
  const [adminEditPlayerId, setAdminEditPlayerId] = useState("");
  const [showAllMatches, setShowAllMatches] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  // const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  // const [isSigningOut, setIsSigningOut] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

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
          (player) => player.id === savedPlayerId,
        );

        if (playerExists) {
          setSelectedPlayerId(savedPlayerId);
        }
      } else if (user.id) {
        const playerByGoogleUser = players.find(
          (player) => player.user_id === user.id,
        );

        if (playerByGoogleUser) {
          setSelectedPlayerId(playerByGoogleUser.id);
          localStorage.setItem(selectedPlayerStorageKey, playerByGoogleUser.id);
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

  const isAdminEditActive =
    isAdmin && league.predictions_locked && league.admin_edit_mode;

  const activeEditPlayerId = isAdminEditActive
    ? adminEditPlayerId
    : selectedPlayerId;

  const selectedPlayer = players.find(
    (player) => player.id === selectedPlayerId,
  );

  const adminEditPlayer = players.find(
    (player) => player.id === adminEditPlayerId,
  );

  const finishedMatches = matches.filter(
    (match) => getMatchResult(match) !== null,
  );

  function getPredictionForMatch(matchId: string, playerId = selectedPlayerId) {
    return localPredictions.find(
      (prediction) =>
        prediction.match_id === matchId && prediction.player_id === playerId,
    );
  }

  function getPlayerStatsForMatches(
    playerId: string,
    matchesForStats: Match[],
  ) {
    let points = 0;
    let guessed = 0;

    for (const match of matchesForStats) {
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
      totalFinished: matchesForStats.length,
    };
  }

  function getPlayerStats(playerId: string) {
    return getPlayerStatsForMatches(playerId, finishedMatches);
  }

  const rankedPlayers = [...players].sort((a, b) => {
    const statsA = getPlayerStats(a.id);
    const statsB = getPlayerStats(b.id);

    return statsB.points - statsA.points;
  });

  const now = new Date();

  const sortedMatches = [...matches].sort(
    (a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  const pastMatches = sortedMatches.filter(
    (match) => new Date(match.start_time) <= now,
  );

  const futureMatches = sortedMatches.filter(
    (match) => new Date(match.start_time) > now,
  );

  const lastMatch = pastMatches[pastMatches.length - 1];
  const currentMatch = futureMatches[0];
  const nextMatch = futureMatches[1];

  const featuredMatches = [lastMatch, currentMatch, nextMatch].filter(
    (match): match is Match => Boolean(match),
  );

  const matchesToShow = showAllMatches ? sortedMatches : featuredMatches;

  const lastFinishedMatches = [...finishedMatches]
    .sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    )
    .slice(0, 3);
  const latestFinishedMatch = lastFinishedMatches[0];

  const previousFinishedMatches = latestFinishedMatch
    ? finishedMatches.filter((match) => match.id !== latestFinishedMatch.id)
    : finishedMatches;

  const previousRankedPlayers = [...players].sort((a, b) => {
    const statsA = getPlayerStatsForMatches(a.id, previousFinishedMatches);

    const statsB = getPlayerStatsForMatches(b.id, previousFinishedMatches);

    return statsB.points - statsA.points;
  });

  const previousRankByPlayerId = new Map(
    previousRankedPlayers.map((player, index) => [player.id, index + 1]),
  );

  function getRankMovement(
    playerId: string,
    currentRank: number,
  ): {
    direction: "up" | "down" | "same";
    amount: number;
  } {
    const previousRank = previousRankByPlayerId.get(playerId);

    if (!latestFinishedMatch || !previousRank) {
      return { direction: "same", amount: 0 };
    }

    const difference = previousRank - currentRank;

    if (difference > 0) {
      return { direction: "up", amount: difference };
    }

    if (difference < 0) {
      return { direction: "down", amount: Math.abs(difference) };
    }

    return { direction: "same", amount: 0 };
  }

  const closestUpcomingMatch = sortedMatches.find(
    (match) =>
      new Date(match.start_time) > now &&
      match.status !== "finished" &&
      getMatchResult(match) === null,
  );

  function getUpcomingMatchPlayerPick(matchId: string, playerId: string) {
    return localPredictions.find(
      (prediction) =>
        prediction.match_id === matchId && prediction.player_id === playerId,
    )?.pick;
  }

  function getFinishedMatchPlayerStatus(
    match: Match,
    playerId: string,
  ): "correct" | "wrong" | "missing" {
    const result = getMatchResult(match);

    if (!result) {
      return "missing";
    }

    const prediction = localPredictions.find(
      (item) => item.match_id === match.id && item.player_id === playerId,
    );

    if (!prediction) {
      return "missing";
    }

    return prediction.pick === result ? "correct" : "wrong";
  }

  const selectedPlayerPredictions = selectedPlayer
    ? localPredictions.filter(
        (prediction) => prediction.player_id === selectedPlayer.id,
      )
    : [];

  const selectedPlayerPredictionMatchIds = new Set(
    selectedPlayerPredictions.map((prediction) => prediction.match_id),
  );

  const openMatches = matches.filter(
    (match) =>
      new Date(match.start_time) > now &&
      !league.predictions_locked &&
      match.status !== "finished",
  );

  const missingOpenMatches = openMatches.filter(
    (match) => !selectedPlayerPredictionMatchIds.has(match.id),
  );

  const correctPredictions = selectedPlayerPredictions.filter((prediction) => {
    const match = matches.find(
      (currentMatch) => currentMatch.id === prediction.match_id,
    );
    const result = match ? getMatchResult(match) : null;

    return result !== null && prediction.pick === result;
  });

  const wrongPredictions = selectedPlayerPredictions.filter((prediction) => {
    const match = matches.find(
      (currentMatch) => currentMatch.id === prediction.match_id,
    );
    const result = match ? getMatchResult(match) : null;

    return result !== null && prediction.pick !== result;
  });

  const pendingPredictions = selectedPlayerPredictions.filter((prediction) => {
    const match = matches.find(
      (currentMatch) => currentMatch.id === prediction.match_id,
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
      ? Math.round(
          (selectedPlayerPredictionMatchIds.size / matches.length) * 100,
        )
      : 0;

  function getFeaturedMatchLabel(match: Match) {
    if (showAllMatches) return null;

    if (lastMatch && match.id === lastMatch.id) return "משחק אחרון";
    if (currentMatch && match.id === currentMatch.id) return "משחק קרוב";
    if (nextMatch && match.id === nextMatch.id) return "משחק הבא";

    return null;
  }

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  async function savePrediction(matchId: string, pick: "1" | "X" | "2") {
    if (!authEmail) {
      showToast("צריך להתחבר/להרשם  כדי לשלוח ניחוש", "warning");
      return;
    }

    if (!selectedPlayerId) {
      showToast("צריך להתחבר/להרשם כדי לשלוח ניחוש", "warning");
      return;
    }

    if (league.predictions_locked && !isAdminEditActive) {
      showToast("הניחושים נסגרו על ידי מנהל הליגה", "warning");
      return;
    }

    const playerIdToSave = isAdminEditActive
      ? adminEditPlayerId
      : selectedPlayerId;

    if (!playerIdToSave) {
      showToast("צריך לבחור שחקן", "warning");
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
        player_id: playerIdToSave,
        pick,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast("כדי לשלוח ניחוש צריך קודם להצטרף לליגה", "warning");
      } else if (response.status === 403) {
        if (errorData?.error === "League predictions are locked") {
          showToast("הניחושים נסגרו על ידי מנהל הליגה", "warning");
        } else {
          showToast(
            "אין לך הרשאה לשלוח את הניחוש הזה או שהמשחק כבר נסגר",
            "error",
          );
        }
      } else {
        showToast("שגיאה בשמירת הניחוש", "error");
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
          prediction.player_id === savedPrediction.player_id,
      );

      if (existingPrediction) {
        return current.map((prediction) =>
          prediction.match_id === savedPrediction.match_id &&
          prediction.player_id === savedPrediction.player_id
            ? savedPrediction
            : prediction,
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

  // async function copyLeagueLink() {
  //   const leagueUrl = `${window.location.origin}/join-league?code=${league.code}`;

  //   try {
  //     await navigator.clipboard.writeText(leagueUrl);
  //     showToast("הלינק הועתק", "success");
  //   } catch (error) {
  //     console.error(error);
  //     showToast("לא הצלחתי להעתיק את הלינק", "error");
  //   }
  // }

  //   function shareOnWhatsApp() {
  //     const leagueUrl = `${window.location.origin}/join-league?code=${league.code}`;

  //     const message = `הצטרף לליגת הניחושים שלי:
  // ${league.name}
  // ${leagueUrl}`;

  //     const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  //     window.open(whatsappUrl, "_blank");
  //   }

  async function copyLeagueLink() {
    const leagueUrl = `${window.location.origin}/league/${encodeURIComponent(league.code)}`;

    try {
      await navigator.clipboard.writeText(leagueUrl);
      showToast("הלינק הועתק", "success");
    } catch (error) {
      console.error(error);
      showToast("לא הצלחתי להעתיק את הלינק", "error");
    }
  }

  function shareOnWhatsApp() {
    const leagueUrl = `${window.location.origin}/league/${encodeURIComponent(league.code)}`;

    const message = `הצטרף לליגת הניחושים שלי:
${league.name}
${leagueUrl}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, "_blank");
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
      {authEmail && (
        <UserMenu
          email={authEmail}
          showToast={showToast}
          onSignedOut={() => {
            setSelectedPlayerId("");
            setIsAdmin(false);
            setAuthEmail("");
            window.location.href = "/";
          }}
        />
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

            {league.predictions_locked && !isAdminEditActive && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                🔒 הניחושים נסגרו על ידי מנהל הליגה
              </div>
            )}

            {isAdminEditActive && (
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200">
                ⚠️ מצב עריכת מנהל פעיל — ניתן לערוך ניחושים עבור כל שחקן
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

        {!selectedPlayer && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
            {!selectedPlayer && (
              <div>
                <h2 className="mb-2 text-xl font-black sm:text-2xl">
                  עדיין לא הצטרפת לליגה
                </h2>

                <p className="mb-4 text-sm leading-6 text-slate-400 sm:mb-5">
                  כדי לשלוח ניחושים צריך להתחבר ולהצטרף עם שם שחקן.
                </p>

                {!authEmail ? (
                  <>
                    <Link
                      href={`/login?next=${encodeURIComponent(
                        `/league/${league.code}`,
                      )}`}
                      onClick={() => {
                        localStorage.setItem(
                          "redirect-after-login",
                          `/league/${league.code}`,
                        );
                      }}
                      className="block rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 text-center font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600"
                    >
                      התחבר / הירשם כדי להצטרף
                    </Link>

                    <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                      אחרי ההתחברות תחזור אוטומטית לליגה הזאת.
                    </p>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/join-league?code=${encodeURIComponent(league.code)}`}
                      className="block rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 text-center font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600"
                    >
                      הצטרף לליגה הזאת
                    </Link>

                    <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                      נשאר רק לבחור שם שחקן ולאשר הצטרפות.
                    </p>
                  </>
                )}
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
            <>
              <div className="space-y-2 sm:space-y-3">
                {rankedPlayers.map((player, index) => {
                  const stats = getPlayerStats(player.id);
                  const isCurrentPlayer = player.id === selectedPlayerId;
                  const movement = getRankMovement(player.id, index + 1);

                  const podium =
                    index === 0
                      ? {
                          card: "border-yellow-300/75 bg-[radial-gradient(circle_at_16%_50%,rgba(250,204,21,0.24),transparent_30%),linear-gradient(90deg,rgba(120,83,10,0.30),rgba(18,24,38,0.72)_48%,rgba(2,6,23,0.88))] shadow-[0_0_34px_rgba(250,204,21,0.18)]",
                          label: "מוביל הליגה",
                          labelClass:
                            "border-yellow-300/45 bg-yellow-400/15 text-yellow-100",
                          edge: "bg-yellow-300/70",
                        }
                      : index === 1
                        ? {
                            card: "border-slate-200/55 bg-[radial-gradient(circle_at_16%_50%,rgba(226,232,240,0.16),transparent_28%),linear-gradient(90deg,rgba(71,85,105,0.38),rgba(20,29,45,0.78)_48%,rgba(2,6,23,0.88))] shadow-[0_0_24px_rgba(226,232,240,0.10)]",
                            label: "מקום שני",
                            labelClass:
                              "border-slate-200/30 bg-slate-100/10 text-slate-100",
                            edge: "bg-slate-200/60",
                          }
                        : index === 2
                          ? {
                              card: "border-orange-300/50 bg-[radial-gradient(circle_at_12%_50%,rgba(251,146,60,0.18),transparent_22%),linear-gradient(90deg,rgba(124,45,18,0.34),rgba(16,24,38,0.80)_44%,rgba(2,6,23,0.94))] shadow-[0_0_20px_rgba(251,146,60,0.10)]",
                              label: "מקום שלישי",
                              labelClass:
                                "border-orange-300/35 bg-orange-400/10 text-orange-100",
                              edge: "bg-orange-300/55",
                            }
                          : {
                              card: isCurrentPlayer
                                ? "border-green-400/35 bg-green-500/10"
                                : "border-white/10 bg-slate-950/60",
                              label: null,
                              labelClass: "",
                              edge: "bg-white/10",
                            };

                  return (
                    <div
                      key={player.id}
                      className={`relative flex items-center justify-between overflow-hidden rounded-2xl border px-3 py-3 sm:px-4 sm:py-4 ${podium.card}`}
                    >
                      {index < 3 && (
                        <>
                          <div className="pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-white/[0.07] to-transparent" />
                          <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-transparent via-white/50 to-transparent" />
                        </>
                      )}

                      <div className="relative flex min-w-0 items-center gap-3 sm:gap-4">
                        <div className="flex shrink-0 items-center justify-center">
                          <RankShield rank={index + 1} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-black text-white sm:text-2xl">
                              {player.name}
                            </p>

                            {podium.label && (
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-black sm:text-xs ${podium.labelClass}`}
                              >
                                {podium.label}
                              </span>
                            )}

                            {isCurrentPlayer && (
                              <span className="rounded-full border border-green-400/20 bg-green-500/15 px-2 py-1 text-[10px] font-black text-green-300 sm:text-xs">
                                אתה
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-slate-400 sm:text-base">
                            פגיעות: {stats.points}/{stats.totalFinished}
                          </p>
                        </div>
                      </div>

                      <div className="relative flex shrink-0 items-center gap-3 sm:gap-5">
                        <div className="min-w-[58px] text-center sm:min-w-[78px]">
                          {movement.direction === "up" ? (
                            <>
                              <p className="text-2xl font-black leading-none text-green-300 sm:text-3xl">
                                ↑ {movement.amount}
                              </p>
                              <p className="mt-1 text-[10px] font-bold text-green-300/85 sm:text-xs">
                                עלייה בדירוג
                              </p>
                            </>
                          ) : movement.direction === "down" ? (
                            <>
                              <p className="text-2xl font-black leading-none text-red-300 sm:text-3xl">
                                ↓ {movement.amount}
                              </p>
                              <p className="mt-1 text-[10px] font-bold text-red-300/85 sm:text-xs">
                                ירידה בדירוג
                              </p>
                            </>
                          ) : (
                            <p className="text-3xl font-black leading-none text-slate-400 sm:text-4xl">
                              —
                            </p>
                          )}
                        </div>

                        <div className={`h-12 w-px sm:h-14 ${podium.edge}`} />

                        <div className="w-10 text-left sm:w-12">
                          <p className="text-3xl font-black leading-none text-green-300 sm:text-4xl">
                            {stats.points}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500 sm:text-xs">
                            נק׳
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-[11px] font-bold sm:gap-x-6 sm:text-xs">
                <span className="text-green-300">↑ עלייה בדירוג</span>
                <span className="text-red-300">↓ ירידה בדירוג</span>
                <span className="text-slate-400">— ללא שינוי</span>
              </div>
            </>
          )}
        </div>

        {(closestUpcomingMatch || lastFinishedMatches.length > 0) && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/80 shadow-xl backdrop-blur-xl sm:mb-5">
            <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-violet-500/15 px-3 py-3 text-center">
              <h2 className="text-base font-black text-white sm:text-lg">
                {closestUpcomingMatch
                  ? "ניחושים - המשחק הקרוב + 3 המשחקים האחרונים"
                  : "ניחושים - 3 המשחקים האחרונים"}
              </h2>
            </div>

            <div className="divide-y divide-white/10">
              {closestUpcomingMatch && (
                <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 p-2.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3 sm:p-3">
                  <div className="flex flex-col items-center justify-center rounded-xl border border-blue-400/20 bg-blue-950/20 px-1.5 py-2 text-center">
                    <p className="w-full truncate text-xs font-black text-white sm:text-sm">
                      {closestUpcomingMatch.home_team}
                    </p>

                    <div className="my-1.5 rounded-lg border border-yellow-300/20 bg-yellow-400/10 px-2 py-1 text-center">
                      <p className="text-base font-black text-yellow-300 sm:text-lg">
                        VS
                      </p>

                      <p className="text-[10px] font-bold text-slate-200 sm:text-xs">
                        {new Date(
                          closestUpcomingMatch.start_time,
                        ).toLocaleTimeString("he-IL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <p className="w-full truncate text-xs font-black text-white sm:text-sm">
                      {closestUpcomingMatch.away_team}
                    </p>
                  </div>

                  <div className="min-w-0 overflow-x-auto pb-2">
                    <div
                      dir="rtl"
                      className="flex w-max min-w-full items-center justify-start gap-2"
                    >
                      {players.map((player) => {
                        const pick = getUpcomingMatchPlayerPick(
                          closestUpcomingMatch.id,
                          player.id,
                        );

                        const isCurrentPlayer = player.id === selectedPlayerId;

                        return (
                          <div
                            key={player.id}
                            className="flex w-[46px] shrink-0 flex-col items-center text-center sm:w-[58px]"
                          >
                            <p
                              className={`w-full truncate text-[10px] font-black sm:text-xs ${
                                isCurrentPlayer ? "text-cyan-300" : "text-white"
                              }`}
                            >
                              {player.name}
                            </p>

                            <div
                              className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full border text-base font-black sm:h-9 sm:w-9 sm:text-lg ${
                                pick
                                  ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                                  : "border-slate-500/30 bg-slate-800 text-slate-400"
                              }`}
                            >
                              {pick || "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {lastFinishedMatches.map((match) => (
                <div
                  key={match.id}
                  className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 p-2.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3 sm:p-3"
                >
                  <div className="flex flex-col items-center justify-center rounded-xl border border-blue-400/20 bg-blue-950/20 px-1.5 py-2 text-center">
                    <p className="w-full truncate text-xs font-black text-white sm:text-sm">
                      {match.home_team}
                    </p>

                    <div className="my-1.5 rounded-lg border border-yellow-300/20 bg-yellow-400/10 px-2 py-1 text-base font-black text-yellow-300 sm:text-lg">
                      {match.home_score} - {match.away_score}
                    </div>

                    <p className="w-full truncate text-xs font-black text-white sm:text-sm">
                      {match.away_team}
                    </p>
                  </div>

                  <div className="min-w-0 overflow-x-auto pb-2">
                    <div
                      dir="rtl"
                      className="flex w-max min-w-full items-center justify-start gap-2"
                    >
                      {players.map((player) => {
                        const status = getFinishedMatchPlayerStatus(
                          match,
                          player.id,
                        );
                        const isCurrentPlayer = player.id === selectedPlayerId;

                        return (
                          <div
                            key={player.id}
                            className="flex w-[46px] shrink-0 flex-col items-center text-center sm:w-[58px]"
                          >
                            <p
                              className={`w-full truncate text-[10px] font-black sm:text-xs ${
                                isCurrentPlayer ? "text-cyan-300" : "text-white"
                              }`}
                            >
                              {player.name}
                            </p>

                            <div
                              className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full border text-lg font-black sm:h-9 sm:w-9 sm:text-xl ${
                                status === "correct"
                                  ? "border-green-400/40 bg-green-500/20 text-green-300"
                                  : status === "wrong"
                                    ? "border-red-400/40 bg-red-500/20 text-red-300"
                                    : "border-slate-500/30 bg-slate-800 text-slate-400"
                              }`}
                            >
                              {status === "correct"
                                ? "✓"
                                : status === "wrong"
                                  ? "×"
                                  : "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedPlayer && (
          <>
            <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-xl sm:mb-6 sm:rounded-3xl sm:p-6">
              <div className="mb-4 flex items-center justify-between sm:mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-300/25 bg-gradient-to-br from-yellow-400/20 to-orange-500/10 text-2xl shadow-lg shadow-yellow-950/30 sm:h-12 sm:w-12">
                    🎯
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-white sm:text-2xl">
                      הניחושים שלי
                    </h2>

                    <p className="mt-0.5 text-xs font-semibold text-slate-400 sm:text-sm">
                      הביצועים שלך עד עכשיו
                    </p>
                  </div>
                </div>

                <div className="rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1.5 text-xs font-black text-green-300 sm:px-4 sm:text-sm">
                  {predictionAccuracy}% פגיעה
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
                <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-3 sm:p-5">
                  <p className="text-2xl sm:text-3xl">✓</p>
                  <p className="mt-2 text-3xl font-black text-green-300 sm:text-4xl">
                    {correctPredictions.length}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400 sm:text-sm">
                    נכונים
                  </p>
                </div>

                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 sm:p-5">
                  <p className="text-2xl sm:text-3xl">×</p>
                  <p className="mt-2 text-3xl font-black text-red-300 sm:text-4xl">
                    {wrongPredictions.length}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400 sm:text-sm">
                    שגויים
                  </p>
                </div>

                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 sm:p-5">
                  <p className="text-2xl sm:text-3xl">⌛</p>
                  <p className="mt-2 text-3xl font-black text-yellow-300 sm:text-4xl">
                    {pendingPredictions.length}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400 sm:text-sm">
                    ממתינים
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:mt-5 sm:p-5">
                <div className="mb-2 flex items-center justify-between text-sm sm:text-base">
                  <span className="font-black text-white">התקדמות כללית</span>
                  <span className="font-black text-green-300">
                    {selectedPlayerPredictionMatchIds.size}/{matches.length}
                  </span>
                </div>

                <div className="h-4 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all"
                    style={{ width: `${predictionProgress}%` }}
                  />
                </div>

                <p className="mt-2 text-xs font-bold text-green-300 sm:text-sm">
                  {predictionProgress}% הושלמו
                </p>
              </div>
            </div>
          </>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex items-center justify-between sm:mb-5">
            <h2 className="text-xl font-black sm:text-2xl">משחקים וניחושים</h2>

            <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-400 sm:px-4 sm:py-2 sm:text-xs">
              {showAllMatches ? matches.length : matchesToShow.length} מוצגים
            </span>
          </div>

          {isAdminEditActive && (
            <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 sm:mb-5">
              <label
                htmlFor="admin-edit-player"
                className="mb-2 block text-sm font-bold text-amber-200"
              >
                עריכת ניחושים עבור שחקן
              </label>

              <select
                id="admin-edit-player"
                value={adminEditPlayerId}
                onChange={(event) => setAdminEditPlayerId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
              >
                <option value="">בחר שחקן...</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>

              {adminEditPlayer && (
                <p className="mt-2 text-xs text-amber-100/80">
                  מציג ושומר ניחושים עבור: {adminEditPlayer.name}
                </p>
              )}
            </div>
          )}

          {matches.length === 0 ? (
            <p className="text-sm text-slate-400">
              עדיין לא נוספו משחקים. אפשר להוסיף דרך ניהול ליגה.
            </p>
          ) : (
            <>
              <div className="space-y-3 sm:space-y-4">
                {matchesToShow.map((match) => {
                  const currentPrediction = getPredictionForMatch(
                    match.id,
                    activeEditPlayerId,
                  );
                  const isTimeLocked = new Date(match.start_time) <= new Date();
                  const isMatchLocked = isAdminEditActive
                    ? false
                    : league.predictions_locked || isTimeLocked;
                  const canEditPredictions = isAdminEditActive
                    ? Boolean(authEmail && adminEditPlayerId)
                    : Boolean(authEmail && selectedPlayer);
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

                      {!canEditPredictions ? null : (
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
                              {isAdminEditActive ? "ניחוש השחקן" : "הניחוש שלך"}
                              :{" "}
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
                        !isAdminEditActive &&
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
                  {showAllMatches ? "הצג פחות משחקים" : "הצג את כל המשחקים"}
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
