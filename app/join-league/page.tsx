"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";

type PlayerResponse = {
  player: {
    id: string;
    league_id: string;
    name: string;
    user_id: string | null;
  };
  alreadyJoined: boolean;
};

export default function JoinLeaguePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [playerName, setPlayerName] = useState("");
  const [leagueCode, setLeagueCode] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");

    if (codeFromUrl) {
      setLeagueCode(codeFromUrl.trim().toUpperCase());
    }

    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || "");
      } else {
        setUserId("");
        setUserEmail("");
      }

      setIsCheckingUser(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || "");
      } else {
        setUserId("");
        setUserEmail("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      alert("כדי להצטרף לליגה צריך להתחבר עם Google");
      router.push("/login");
      return;
    }

    if (!playerName.trim() || !leagueCode.trim()) {
      alert("צריך למלא שם וקוד ליגה");
      return;
    }

    setIsLoading(true);

    const cleanCode = leagueCode.trim().toUpperCase();

    const response = await fetch(`/api/leagues/${cleanCode}/players`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: playerName.trim(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        alert("צריך להתחבר עם Google כדי להצטרף לליגה");
        router.push("/login");
      } else if (response.status === 404) {
        alert("לא נמצאה ליגה עם הקוד הזה");
      } else {
        alert("שגיאה בהצטרפות לליגה");
      }

      setIsLoading(false);
      return;
    }

    const data = (await response.json()) as PlayerResponse;

    localStorage.setItem("last-league-code", cleanCode);
    localStorage.setItem(`selected-player-${cleanCode}`, data.player.id);

    if (data.alreadyJoined) {
      alert("כבר הצטרפת לליגה הזאת. מחזיר אותך לשחקן הקיים שלך.");
    }

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

          {isCheckingUser ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-center">
              <p className="text-sm text-slate-300">בודק התחברות...</p>
            </div>
          ) : userId ? (
            <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-500/10 p-4 text-center">
              <p className="text-xs text-slate-400">מחובר עם Google</p>
              <p className="mt-1 text-sm font-bold text-green-300">
                {userEmail}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                user_id: {userId.slice(0, 8)}...
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-center">
              <p className="text-sm text-red-200">
                כדי להצטרף לליגה צריך להתחבר עם Google.
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
                השם שלך
              </label>

              <input
                type="text"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="לדוגמה: Tegabu"
                disabled={!userId || isCheckingUser}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-white outline-none transition placeholder:text-slate-600 focus:border-green-400 disabled:opacity-50"
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
                disabled={!userId || isCheckingUser}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-center text-xl font-black tracking-widest text-green-300 outline-none transition placeholder:text-slate-600 focus:border-green-400 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || isCheckingUser || !userId}
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

          <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
            <p className="text-sm leading-6 text-yellow-100">
              השחקן שלך נשמר לחשבון ה־Google שלך. אותו חשבון לא יכול להצטרף
              פעמיים לאותה ליגה.
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