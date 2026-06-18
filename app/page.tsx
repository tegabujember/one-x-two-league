"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [lastLeagueCode, setLastLeagueCode] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isCheckingUser, setIsCheckingUser] = useState(true);

  useEffect(() => {
    async function loadHomeState() {
      const savedLeagueCode = localStorage.getItem("last-league-code");

      if (savedLeagueCode) {
        setLastLeagueCode(savedLeagueCode);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setUserEmail(user.email);
      } else {
        setUserEmail("");
      }

      const redirectAfterLogin = localStorage.getItem("redirect-after-login");

      if (redirectAfterLogin && user) {
        localStorage.removeItem("redirect-after-login");
        router.replace(redirectAfterLogin);
        return;
      }

      setIsCheckingUser(false);
    }

    loadHomeState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      } else {
        setUserEmail("");
      }

      setIsCheckingUser(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  function saveRedirectBeforeLogin() {
    if (lastLeagueCode) {
      localStorage.setItem(
        "redirect-after-login",
        `/league/${lastLeagueCode}`
      );
    } else {
      localStorage.removeItem("redirect-after-login");
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.28),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.28),_transparent_35%)]" />

      <div className="absolute top-10 left-8 h-24 w-24 rounded-full bg-green-500/20 blur-3xl" />
      <div className="absolute bottom-10 right-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-4xl">🏆</span>
          </div>

          <p className="text-sm font-semibold tracking-[0.35em] text-green-300">
            WORLD CUP MODE
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <h1 className="text-center text-4xl font-black tracking-tight">
            1X2 League
          </h1>

          <p className="mt-3 text-center text-lg font-semibold text-slate-200">
            ליגת ניחושים לחברים
          </p>

          <p className="mt-2 text-center text-sm leading-6 text-slate-400">
            צור ליגה, שתף לחברים, נחשו 1 / X / 2 וצברו נקודות לאורך הטורניר.
          </p>

          {!isCheckingUser && (
            <div className="mt-6">
              {userEmail ? (
                <div className="rounded-2xl border border-green-400/20 bg-green-500/10 p-4 text-center">
                  <p className="text-xs text-slate-400">מחובר בתור</p>
                  <p className="mt-1 break-all text-sm font-bold text-green-300">
                    {userEmail}
                  </p>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={saveRedirectBeforeLogin}
                  className="block w-full rounded-2xl bg-white px-5 py-4 text-center font-black text-slate-950 shadow-lg shadow-black/20 transition hover:scale-[1.02]"
                >
                  התחבר / הירשם עם Google
                </Link>
              )}
            </div>
          )}

          <div className="mt-8 space-y-4">
            {lastLeagueCode && (
              <Link
                href={`/league/${lastLeagueCode}`}
                className="block w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 text-center font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600"
              >
                המשך לליגה האחרונה
              </Link>
            )}

            <Link
              href="/create-league"
              className="block w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 px-5 py-4 text-center font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600"
            >
              צור ליגה חדשה
            </Link>

            <Link
              href="/join-league"
              className="block w-full rounded-2xl border border-white/10 bg-slate-900/80 px-5 py-4 text-center font-bold text-slate-100 transition hover:scale-[1.02] hover:bg-slate-800"
            >
              הצטרף לליגה עם קוד
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-slate-950/60 p-3 border border-white/10">
              <p className="text-2xl font-black text-green-300">1</p>
              <p className="text-xs text-slate-400 mt-1">בית</p>
            </div>

            <div className="rounded-2xl bg-slate-950/60 p-3 border border-white/10">
              <p className="text-2xl font-black text-yellow-300">X</p>
              <p className="text-xs text-slate-400 mt-1">תיקו</p>
            </div>

            <div className="rounded-2xl bg-slate-950/60 p-3 border border-white/10">
              <p className="text-2xl font-black text-blue-300">2</p>
              <p className="text-xs text-slate-400 mt-1">חוץ</p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Built for friends, football and bragging rights ⚽
        </p>
      </div>
    </main>
  );
}