"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function generateLeagueCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  return code;
}

function generateAdminCode() {
  const numbers = "0123456789";
  let code = "";

  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return code;
}

export default function CreateLeaguePage() {
  const router = useRouter();

  const [leagueName, setLeagueName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leagueName.trim() || !adminName.trim()) {
      alert("צריך למלא שם ליגה ואת השם שלך");
      return;
    }

    setIsLoading(true);

    const newCode = generateLeagueCode();
    const newAdminCode = generateAdminCode();

    const { data: leagueData, error: leagueError } = await supabase
      .from("leagues")
      .insert({
        name: leagueName.trim(),
        code: newCode,
        admin_name: adminName.trim(),
        admin_code: newAdminCode,
      })
      .select()
      .single();

    if (leagueError || !leagueData) {
      console.error(leagueError);
      alert("שגיאה ביצירת הליגה");
      setIsLoading(false);
      return;
    }

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .insert({
        league_id: leagueData.id,
        name: adminName.trim(),
      })
      .select()
      .single();

    if (playerError || !playerData) {
      console.error(playerError);
      alert("הליגה נוצרה, אבל הייתה שגיאה ביצירת השחקן");
      setIsLoading(false);
      return;
    }

    localStorage.setItem(`league-admin-${newCode}`, newAdminCode);
    localStorage.setItem("last-league-code", newCode);
    localStorage.setItem(`selected-player-${newCode}`, playerData.id);

    alert(`הליגה נוצרה בהצלחה!\nקוד מנהל: ${newAdminCode}\nשמור אותו אצלך.`);

    router.push(`/league/${newCode}`);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />
      <div className="absolute top-10 left-8 h-24 w-24 rounded-full bg-green-500/20 blur-3xl" />
      <div className="absolute bottom-10 right-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-4xl">🏆</span>
          </div>

          <p className="text-sm font-semibold tracking-[0.35em] text-green-300">
            CREATE LEAGUE
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <h1 className="text-center text-3xl font-black tracking-tight">
            צור ליגה חדשה
          </h1>

          <p className="mt-3 text-center text-sm leading-6 text-slate-400">
            פתח ליגת ניחושים, קבל קוד מנהל, ושתף את הלינק לחברים.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                שם הליגה
              </label>

              <input
                type="text"
                value={leagueName}
                onChange={(event) => setLeagueName(event.target.value)}
                placeholder="לדוגמה: מונדיאל חברים"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-green-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                השם שלך
              </label>

              <input
                type="text"
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
                placeholder="לדוגמה: Tegabu"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-green-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 px-5 py-4 font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? "יוצר ליגה..." : "צור ליגה"}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
            <p className="text-sm leading-6 text-yellow-100">
              אחרי יצירת הליגה תקבל קוד מנהל. שמור אותו — איתו תוכל להוסיף
              משחקים ולעדכן תוצאות.
            </p>
          </div>

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