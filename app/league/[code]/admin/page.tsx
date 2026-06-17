"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

  const loadLeagueAndMatches = useCallback(async () => {
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
  }, [code, router]);

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
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />
      <div className="absolute top-10 left-8 h-24 w-24 rounded-full bg-green-500/20 blur-3xl" />
      <div className="absolute bottom-10 right-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-4xl">🛠️</span>
          </div>

          <p className="text-sm font-semibold tracking-[0.35em] text-green-300">
            ADMIN PANEL
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl mb-6">
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-2">ניהול ליגה</p>

            <h1 className="text-4xl font-black tracking-tight">
              הוספת משחקים
            </h1>

            {league && (
              <div className="mt-5 inline-flex flex-col items-center rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-3">
                <span className="text-lg font-bold">{league.name}</span>
                <span className="mt-1 text-sm text-slate-400">
                  קוד ליגה:{" "}
                  <span className="font-black tracking-widest text-green-300">
                    {league.code}
                  </span>
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                קבוצה ביתית
              </label>

              <input
                type="text"
                value={homeTeam}
                onChange={(event) => setHomeTeam(event.target.value)}
                placeholder="לדוגמה: מקסיקו"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-green-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                קבוצה אורחת
              </label>

              <input
                type="text"
                value={awayTeam}
                onChange={(event) => setAwayTeam(event.target.value)}
                placeholder="לדוגמה: דרום אפריקה"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-green-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                תאריך ושעה
              </label>

              <input
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition focus:border-green-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 px-5 py-4 font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? "מוסיף משחק..." : "הוסף משחק"}
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-black">עדכון תוצאות</h2>

            <span className="rounded-full bg-slate-950/70 px-4 py-2 text-xs text-slate-400 border border-white/10">
              {matches.length} משחקים
            </span>
          </div>

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

  const isFinished = match.status === "finished";

  return (
    <div className="rounded-3xl bg-slate-950/60 border border-white/10 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <span
            className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              isFinished
                ? "bg-green-500/20 text-green-300"
                : "bg-blue-500/20 text-blue-300"
            }`}
          >
            {isFinished ? "הסתיים" : "טרם שוחק"}
          </span>

          <p className="text-xl font-black">{match.home_team}</p>
          <p className="my-1 text-sm text-slate-500">נגד</p>
          <p className="text-xl font-black">{match.away_team}</p>

          <p className="text-sm text-slate-400 mt-3">
            {new Date(match.start_time).toLocaleString("he-IL")}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-white/10 px-4 py-3 text-center min-w-20">
          <p className="text-xs text-slate-500 mb-1">תוצאה</p>

          <p className="text-xl font-black">
            {isFinished ? `${match.home_score} - ${match.away_score}` : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <input
          type="number"
          min="0"
          value={homeScore}
          onChange={(event) => setHomeScore(event.target.value)}
          placeholder="בית"
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 text-center text-xl font-black outline-none transition focus:border-green-400"
        />

        <input
          type="number"
          min="0"
          value={awayScore}
          onChange={(event) => setAwayScore(event.target.value)}
          placeholder="חוץ"
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 text-center text-xl font-black outline-none transition focus:border-green-400"
        />
      </div>

      <button
        type="button"
        onClick={() => onUpdate(match.id, homeScore, awayScore)}
        className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600"
      >
        עדכן תוצאה
      </button>
    </div>
  );
}