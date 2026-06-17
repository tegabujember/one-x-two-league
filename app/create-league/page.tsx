"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";

type CreateLeagueResponse = {
  league: {
    id: string;
    name: string;
    code: string;
    admin_code: string | null;
    owner_id: string | null;
  };
  player: {
    id: string;
    league_id: string;
    name: string;
    user_id: string | null;
  };
  admin_code: string;
};

export default function CreateLeaguePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [leagueName, setLeagueName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setUserEmail(user.email);
      } else {
        setUserEmail("");
      }

      setIsCheckingUser(false);
    }

    loadUser();
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("כדי ליצור ליגה צריך להתחבר עם Google");
      router.push("/login");
      return;
    }

    if (!leagueName.trim() || !adminName.trim()) {
      alert("צריך למלא שם ליגה ואת השם שלך");
      return;
    }

    setIsLoading(true);

    const response = await fetch("/api/leagues", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        league_name: leagueName.trim(),
        admin_name: adminName.trim(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("כדי ליצור ליגה צריך להתחבר עם Google");
        router.push("/login");
      } else {
        alert("שגיאה ביצירת הליגה");
      }

      setIsLoading(false);
      return;
    }

    const data = (await response.json()) as CreateLeagueResponse;

    localStorage.setItem(`league-admin-${data.league.code}`, data.admin_code);
    localStorage.setItem("last-league-code", data.league.code);
    localStorage.setItem(`selected-player-${data.league.code}`, data.player.id);

    alert(
      `הליגה נוצרה בהצלחה!\nקוד מנהל: ${data.admin_code}\nשמור אותו אצלך.`
    );

    router.push(`/league/${data.league.code}`);
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

          {isCheckingUser ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-center">
              <p className="text-sm text-slate-300">בודק התחברות...</p>
            </div>
          ) : userEmail ? (
            <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-500/10 p-4 text-center">
              <p className="text-xs text-slate-400">מחובר עם Google</p>
              <p className="mt-1 text-sm font-bold text-green-300">
                {userEmail}
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-center">
              <p className="text-sm text-red-200">
                כדי ליצור ליגה צריך להתחבר עם Google.
              </p>

              <Link
                href="/login"
                className="mt-4 block rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.02]"
              >
                התחבר עם Google
              </Link>
            </div>
          )}

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
                disabled={!userEmail || isCheckingUser}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-green-400 disabled:opacity-50"
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
                disabled={!userEmail || isCheckingUser}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-green-400 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || isCheckingUser || !userEmail}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 px-5 py-4 font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? "יוצר ליגה..." : "צור ליגה"}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
            <p className="text-sm leading-6 text-yellow-100">
              יצירת הליגה מתבצעת עכשיו דרך API מאובטח. הליגה תיקשר לחשבון
              ה־Google שלך והשחקן הראשון ייווצר עבורך אוטומטית.
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