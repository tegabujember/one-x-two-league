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
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800">
        <h1 className="text-2xl font-bold text-center mb-6">
          הצטרף לליגה
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm text-slate-300">
              השם שלך
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="לדוגמה: Tegabu"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-slate-300">
              קוד ליגה
            </label>
            <input
              type="text"
              value={leagueCode}
              onChange={(event) =>
                setLeagueCode(event.target.value.toUpperCase())
              }
              placeholder="לדוגמה: AB72K"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "מצטרף..." : "הצטרף"}
          </button>
        </form>

        <Link
          href="/"
          className="block text-center text-sm text-slate-400 mt-6 hover:text-white"
        >
          חזור
        </Link>
      </div>
    </main>
  );
}