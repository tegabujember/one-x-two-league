"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function JoinLeaguePage() {
  const router = useRouter();

  const [playerName, setPlayerName] = useState("");
  const [leagueCode, setLeagueCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");

    if (codeFromUrl) {
      setLeagueCode(codeFromUrl.trim().toUpperCase());
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!playerName.trim() || !leagueCode.trim()) {
      alert("צריך למלא שם וקוד ליגה");
      return;
    }

    setIsLoading(true);

    const cleanCode = leagueCode.trim().toUpperCase();

    const { data: leagueData, error: leagueError } = await supabase
      .from("leagues")
      .select("*")
      .eq("code", cleanCode)
      .single();

    if (leagueError || !leagueData) {
      console.error(leagueError);
      alert("לא נמצאה ליגה עם הקוד הזה");
      setIsLoading(false);
      return;
    }

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .insert({
        league_id: leagueData.id,
        name: playerName.trim(),
      })
      .select()
      .single();

    if (playerError || !playerData) {
      console.error(playerError);
      alert("שגיאה בהצטרפות לליגה");
      setIsLoading(false);
      return;
    }

    localStorage.setItem("last-league-code", cleanCode);
    localStorage.setItem(`selected-player-${cleanCode}`, playerData.id);

    router.push(`/league/${cleanCode}`);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />
      <div className="absolute top-10 left-8 h-24 w-24 rounded-full bg-green-500/20 blur-3xl" />
      <div className="absolute bottom-10 right-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-4xl">⚽</span>
          </div>

          <p className="text-sm font-semibold tracking-[0.35em] text-green-300">
            JOIN LEAGUE
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <h1 className="text-center text-3xl font-black tracking-tight">
            הצטרף לליגה
          </h1>

          <p className="mt-3 text-center text-sm leading-6 text-slate-400">
            הכנס שם שחקן וקוד ליגה, ותוכל להתחיל לשלוח ניחושים.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                השם שלך
              </label>

              <input
                type="text"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="לדוגמה: Tegabu"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-green-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                קוד ליגה
              </label>

              <input
                type="text"
                value={leagueCode}
                onChange={(event) =>
                  setLeagueCode(event.target.value.toUpperCase())
                }
                placeholder="לדוגמה: AB72K"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-center text-xl font-black tracking-widest text-green-300 outline-none transition placeholder:text-slate-600 focus:border-green-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? "מצטרף לליגה..." : "הצטרף לליגה"}
            </button>
          </form>

          {leagueCode && (
            <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-500/10 p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">אתה מצטרף לליגה</p>
              <p className="text-2xl font-black tracking-widest text-green-300">
                {leagueCode}
              </p>
            </div>
          )}

          <Link
            href="/"
            className="mt-6 block text-center text-sm text-slate-400 hover:text-white"
          >
            חזור לדף הבית
          </Link>
        </div>
      </div>
    </main>
  );
}