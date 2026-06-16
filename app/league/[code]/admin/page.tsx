"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type League = {
  id: string;
  name: string;
  code: string;
  admin_code: string | null;
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

export default function LeagueAdminPage() {
  const params = useParams();
  const router = useRouter();

  const code = String(params.code).toUpperCase();

  const [league, setLeague] = useState<League | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [startTime, setStartTime] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  async function loadLeagueAndMatches() {
    setIsLoadingPage(true);

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

    if (
      !leagueData.admin_code ||
      !savedAdminCode ||
      savedAdminCode !== leagueData.admin_code
    ) {
      alert("אין לך הרשאת מנהל לליגה הזאת");
      router.replace(`/league/${code}`);
      return;
    }

    setLeague(leagueData);

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
  }

  useEffect(() => {
    loadLeagueAndMatches();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!league) {
      alert("הליגה לא נטענה");
      return;
    }

    if (!homeTeam.trim() || !awayTeam.trim() || !startTime.trim()) {
      alert("צריך למלא קבוצה א, קבוצה ב ותאריך/שעה");
      return;
    }

    setIsLoading(true);

    const { error: matchError } = await supabase.from("matches").insert({
      league_id: league.id,
      home_team: homeTeam.trim(),
      away_team: awayTeam.trim(),
      start_time: new Date(startTime).toISOString(),
      status: "upcoming",
    });

    if (matchError) {
      console.error(matchError);
      alert("שגיאה בהוספת משחק");
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

    const { error } = await supabase
      .from("matches")
      .update({
        home_score: homeScoreNumber,
        away_score: awayScoreNumber,
        status: "finished",
      })
      .eq("id", matchId);

    if (error) {
      console.error(error);
      alert("שגיאה בעדכון התוצאה");
      return;
    }

    await loadLeagueAndMatches();
    alert("התוצאה עודכנה בהצלחה");
  }

  if (isLoadingPage) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">טוען...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800 mb-6">
          <p className="text-slate-400 text-sm mb-2">ניהול ליגה</p>

          <h1 className="text-3xl font-bold mb-2">הוספת משחקים</h1>

          {league && (
            <p className="text-slate-400 mb-6">
              {league.name} · קוד: {league.code}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 text-sm text-slate-300">
                קבוצה א
              </label>
              <input
                type="text"
                value={homeTeam}
                onChange={(event) => setHomeTeam(event.target.value)}
                placeholder="לדוגמה: מקסיקו"
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-slate-300">
                קבוצה ב
              </label>
              <input
                type="text"
                value={awayTeam}
                onChange={(event) => setAwayTeam(event.target.value)}
                placeholder="לדוגמה: דרום אפריקה"
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-slate-300">
                תאריך ושעה
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "מוסיף משחק..." : "הוסף משחק"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800">
          <h2 className="text-2xl font-bold mb-4">עדכון תוצאות</h2>

          {matches.length === 0 ? (
            <p className="text-slate-400">עדיין אין משחקים לעדכן.</p>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <ScoreForm
                  key={match.id}
                  match={match}
                  onUpdate={updateScore}
                />
              ))}
            </div>
          )}
        </div>

        <Link
          href={`/league/${code}`}
          className="block text-center text-sm text-slate-400 mt-6 hover:text-white"
        >
          חזור לעמוד הליגה
        </Link>
      </div>
    </main>
  );
}

function ScoreForm({
  match,
  onUpdate,
}: {
  match: Match;
  onUpdate: (matchId: string, homeScore: string, awayScore: string) => void;
}) {
  const [homeScore, setHomeScore] = useState(
    match.home_score !== null ? String(match.home_score) : ""
  );
  const [awayScore, setAwayScore] = useState(
    match.away_score !== null ? String(match.away_score) : ""
  );

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
      <div className="mb-4">
        <p className="font-semibold">
          {match.home_team} - {match.away_team}
        </p>

        <p className="text-sm text-slate-400 mt-1">
          {new Date(match.start_time).toLocaleString("he-IL")}
        </p>

        <p className="text-sm text-slate-400 mt-1">
          מצב: {match.status === "finished" ? "הסתיים" : "טרם שוחק"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <input
          type="number"
          min="0"
          value={homeScore}
          onChange={(event) => setHomeScore(event.target.value)}
          placeholder="תוצאה קבוצה א"
          className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
        />

        <input
          type="number"
          min="0"
          value={awayScore}
          onChange={(event) => setAwayScore(event.target.value)}
          placeholder="תוצאה קבוצה ב"
          className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
        />
      </div>

      <button
        type="button"
        onClick={() => onUpdate(match.id, homeScore, awayScore)}
        className="w-full rounded-xl bg-green-700 py-3 font-semibold hover:bg-green-800"
      >
        עדכן תוצאה
      </button>
    </div>
  );
}