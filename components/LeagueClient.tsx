"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  name: string;
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

  if (match.home_score > match.away_score) {
    return "1";
  }

  if (match.home_score < match.away_score) {
    return "2";
  }

  return "X";
}

export default function LeagueClient({
  league,
  players,
  matches,
  predictions,
}: LeagueClientProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [localPredictions, setLocalPredictions] = useState(predictions);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const selectedPlayerStorageKey = `selected-player-${league.code}`;
  const adminStorageKey = `league-admin-${league.code}`;

  useEffect(() => {
    const savedPlayerId = localStorage.getItem(selectedPlayerStorageKey);

    if (savedPlayerId) {
      const playerExists = players.some((player) => player.id === savedPlayerId);

      if (playerExists) {
        setSelectedPlayerId(savedPlayerId);
      }
    }

    const savedAdminCode = localStorage.getItem(adminStorageKey);

    if (
      savedAdminCode &&
      league.admin_code &&
      savedAdminCode === league.admin_code
    ) {
      setIsAdmin(true);
    }
  }, [players, selectedPlayerStorageKey, adminStorageKey, league.admin_code]);

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

      if (!prediction || !result) {
        continue;
      }

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

  async function savePrediction(matchId: string, pick: "1" | "X" | "2") {
    if (!selectedPlayerId) {
      alert("כדי לשלוח ניחוש צריך קודם להצטרף לליגה");
      return;
    }

    setIsSaving(true);

    const existingPrediction = getPredictionForMatch(matchId);

    if (existingPrediction) {
      const { data, error } = await supabase
        .from("predictions")
        .update({ pick })
        .eq("id", existingPrediction.id)
        .select()
        .single();

      if (error) {
        console.error(error);
        alert("שגיאה בעדכון הניחוש");
        setIsSaving(false);
        return;
      }

      setLocalPredictions((current) =>
        current.map((prediction) =>
          prediction.id === existingPrediction.id ? data : prediction
        )
      );
    } else {
      const { data, error } = await supabase
        .from("predictions")
        .insert({
          match_id: matchId,
          player_id: selectedPlayerId,
          pick,
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        alert("שגיאה בשמירת הניחוש");
        setIsSaving(false);
        return;
      }

      setLocalPredictions((current) => [...current, data]);
    }

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

    if (!codeFromUser) {
      return;
    }

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
    <main className="min-h-screen bg-slate-950 text-white px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800 mb-6">
          <p className="text-slate-400 text-sm mb-2">ליגה</p>

          <h1 className="text-3xl font-bold">{league.name}</h1>

          <p className="text-slate-400 mt-3">קוד ליגה:</p>

          <p className="text-2xl font-bold tracking-widest">{league.code}</p>

          {isAdmin && (
            <Link
              href={`/league/${league.code}/admin`}
              className="block text-center mt-5 rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700"
            >
              ניהול ליגה
            </Link>
          )}

          {!isAdmin && (
            <button
              type="button"
              onClick={handleAdminLogin}
              className="w-full text-center mt-5 rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700"
            >
              כניסת מנהל
            </button>
          )}

          <button
            type="button"
            onClick={copyLeagueLink}
            className="w-full text-center mt-3 rounded-xl bg-slate-800 py-3 font-semibold hover:bg-slate-700"
          >
            העתק לינק להזמנה
          </button>

          <button
            type="button"
            onClick={shareOnWhatsApp}
            className="w-full text-center mt-3 rounded-xl bg-green-700 py-3 font-semibold hover:bg-green-800"
          >
            שתף בוואטסאפ
          </button>
        </div>

        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800 mb-6">
          {selectedPlayer ? (
            <div>
              <p className="text-slate-400 text-sm mb-1">מחובר כשחקן:</p>

              <p className="text-xl font-bold">{selectedPlayer.name}</p>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold mb-3">עדיין לא הצטרפת לליגה</h2>

              <p className="text-slate-400 mb-4">
                כדי לשלוח ניחושים צריך להצטרף עם שם שחקן.
              </p>

              <Link
                href={`/join-league?code=${league.code}`}
                className="block text-center rounded-xl bg-green-700 py-3 font-semibold hover:bg-green-800"
              >
                הצטרף לליגה הזאת
              </Link>
            </div>
          )}

          {isAdmin && (
            <div className="mt-5 border-t border-slate-800 pt-5">
              <h2 className="text-lg font-bold mb-3">בחירת שחקן לאדמין</h2>

              <select
                value={selectedPlayerId}
                onChange={(event) => handlePlayerChange(event.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">בחר שחקן</option>

                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>

              <p className="text-xs text-slate-400 mt-3">
                האפשרות הזאת מוצגת רק למנהל.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800 mb-6">
          <h2 className="text-xl font-bold mb-4">טבלת דירוג</h2>

          {rankedPlayers.length === 0 ? (
            <p className="text-slate-400">עדיין אין שחקנים.</p>
          ) : (
            <div className="space-y-3">
              {rankedPlayers.map((player, index) => {
                const stats = getPlayerStats(player.id);

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl bg-slate-800 border border-slate-700 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {index + 1}. {player.name}
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        פגיעות: {stats.points}/{stats.totalFinished}
                      </p>
                    </div>

                    <span className="text-white font-bold">
                      {stats.points} נק׳
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800">
          <h2 className="text-xl font-bold mb-4">משחקים וניחושים</h2>

          {matches.length === 0 ? (
            <p className="text-slate-400">
              עדיין לא נוספו משחקים. אפשר להוסיף דרך ניהול ליגה.
            </p>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => {
                const currentPrediction = getPredictionForMatch(match.id);
                const isMatchLocked = new Date(match.start_time) <= new Date();
                const matchResult = getMatchResult(match);

                return (
                  <div
                    key={match.id}
                    className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <p className="font-semibold">
                          {match.home_team} - {match.away_team}
                        </p>

                        <p className="text-sm text-slate-400 mt-1">
                          {new Date(match.start_time).toLocaleString("he-IL")}
                        </p>
                      </div>

                      <div className="text-sm text-slate-400">
                        {match.status === "finished"
                          ? `${match.home_score} - ${match.away_score}`
                          : "טרם שוחק"}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
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

                        return (
                          <button
                            key={pick}
                            type="button"
                            disabled={
                              isSaving || !selectedPlayerId || isMatchLocked
                            }
                            onClick={() => savePrediction(match.id, pick)}
                            className={`rounded-xl py-3 font-bold border ${
                              isCorrect
                                ? "bg-green-700 border-green-500 text-white"
                                : isWrong
                                  ? "bg-red-700 border-red-500 text-white"
                                  : isSelected
                                    ? "bg-blue-600 border-blue-500 text-white"
                                    : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700"
                            } disabled:opacity-40`}
                          >
                            {pick}
                            {isCorrect && " ✅"}
                            {isWrong && " ❌"}
                          </button>
                        );
                      })}
                    </div>

                    {matchResult && (
                      <p className="text-xs text-slate-300 mt-3 text-center">
                        תוצאה נכונה לניחוש: {matchResult}
                      </p>
                    )}

                    {isMatchLocked && (
                      <p className="text-xs text-red-300 mt-2 text-center">
                        הניחוש למשחק הזה נסגר
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Link
          href="/"
          className="block text-center text-sm text-slate-400 mt-6 hover:text-white"
        >
          צור / הצטרף לליגה אחרת
        </Link>
      </div>
    </main>
  );
}