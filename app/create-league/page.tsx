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
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800">
        <h1 className="text-2xl font-bold text-center mb-6">
          צור ליגה חדשה
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm text-slate-300">
              שם הליגה
            </label>
            <input
              type="text"
              value={leagueName}
              onChange={(event) => setLeagueName(event.target.value)}
              placeholder="לדוגמה: מונדיאל חברים"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-slate-300">
              השם שלך
            </label>
            <input
              type="text"
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              placeholder="לדוגמה: Tegabu"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "יוצר ליגה..." : "צור ליגה"}
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