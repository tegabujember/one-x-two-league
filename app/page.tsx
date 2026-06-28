"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import InstallAppHelp from "@/components/InstallAppHelp";
import UserMenu from "@/components/auth/UserMenu";

type MyLeague = {
  playerId: string;
  playerName: string;
  leagueId: string;
  leagueName: string;
  leagueCode: string;
};

type MyLeaguesResponse = {
  leagues: MyLeague[];
};

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function getCleanLeagueCode(code: string) {
  const cleanCode = code.trim();

  if (!cleanCode) {
    return "";
  }

  if (isUuidLike(cleanCode)) {
    return "";
  }

  return cleanCode;
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [lastLeagueCode, setLastLeagueCode] = useState("");
  const [lastLeagueName, setLastLeagueName] = useState("");
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const [selectedLeagueCode, setSelectedLeagueCode] = useState("");



  const [userEmail, setUserEmail] = useState("");
  const [isCheckingUser, setIsCheckingUser] = useState(true);

  useEffect(() => {
  async function loadMyLeaguesFromServer() {
  try {
    const response = await fetch("/api/my-leagues", {
      method: "GET",
    });

    if (!response.ok) {
      setMyLeagues([]);
      setSelectedLeagueCode("");
      setLastLeagueCode("");
      setLastLeagueName("");
      return;
    }

    const data = (await response.json()) as MyLeaguesResponse;
    const leagues = data.leagues ?? [];
    const firstLeague = leagues[0];

    setMyLeagues(leagues);

    if (firstLeague?.leagueCode) {
      setSelectedLeagueCode(firstLeague.leagueCode);
      setLastLeagueCode(firstLeague.leagueCode);
      setLastLeagueName(firstLeague.leagueName);
    } else {
      setSelectedLeagueCode("");
      setLastLeagueCode("");
      setLastLeagueName("");
    }
  } catch (error) {
    console.error(error);
    setMyLeagues([]);
    setSelectedLeagueCode("");
    setLastLeagueCode("");
    setLastLeagueName("");
  }
}

  async function loadHomeState() {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");

    if (codeFromUrl) {
      const cleanCode = getCleanLeagueCode(codeFromUrl);

      if (cleanCode) {
        const joinLeagueUrl = `/join-league?code=${encodeURIComponent(
          cleanCode
        )}`;

        localStorage.setItem("redirect-after-login", joinLeagueUrl);
        router.replace(joinLeagueUrl);
        return;
      }

      localStorage.removeItem("redirect-after-login");
      router.replace("/join-league");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      setUserEmail(user.email);
    } else {
      setUserEmail("");
      setLastLeagueCode("");
      setLastLeagueName("");
      setIsCheckingUser(false);
      return;
    }

    const redirectAfterLogin = localStorage.getItem("redirect-after-login");

    if (
      redirectAfterLogin &&
      redirectAfterLogin.startsWith("/") &&
      !redirectAfterLogin.startsWith("//")
    ) {
      localStorage.removeItem("redirect-after-login");
      router.replace(redirectAfterLogin);
      return;
    }

    await loadMyLeaguesFromServer();

    setIsCheckingUser(false);
  }

  loadHomeState();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user?.email) {
      setUserEmail(session.user.email);
      await loadMyLeaguesFromServer();
    } else {
      setUserEmail("");
      setLastLeagueCode("");
      setLastLeagueName("");
      setMyLeagues([]);
      setSelectedLeagueCode("");
    }

    setIsCheckingUser(false);
  });

  return () => {
    subscription.unsubscribe();
  };
}, [router, supabase]);
  function saveRedirectBeforeLogin() {
    localStorage.removeItem("redirect-after-login");
  }

  return (
    <main className="theme-entry-page theme-page min-h-screen overflow-hidden relative flex items-center justify-center px-4 py-10">
      {userEmail && (
        <UserMenu
          email={userEmail}
          onSignedOut={() => {
            setUserEmail("");
            setLastLeagueCode("");
            setLastLeagueName("");
            setMyLeagues([]);
            setSelectedLeagueCode("");
            router.refresh();
          }}
        />
      )}
      <div className="theme-entry-decoration absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.28),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.28),_transparent_35%)]" />

      <div className="theme-entry-decoration absolute top-10 left-8 h-24 w-24 rounded-full bg-green-500/20 blur-3xl" />
      <div className="theme-entry-decoration absolute bottom-10 right-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-4xl">🏆</span>
          </div>

          <p className="theme-brand-accent theme-entry-kicker text-sm font-semibold tracking-[0.35em]">
            WORLD CUP MODE
          </p>
        </div>

        <div className="theme-card theme-entry-card rounded-3xl border p-6 backdrop-blur-xl">
          <h1 className="text-center text-4xl font-black tracking-tight">
            1X2 League
          </h1>

          <p className="theme-text mt-3 text-center text-lg font-semibold">
            ליגת ניחושים לחברים
          </p>

          <p className="theme-muted mt-2 text-center text-sm leading-6">
            צור ליגה, שתף לחברים, נחשו 1 / X / 2 וצברו נקודות לאורך הטורניר.
          </p>

          {!isCheckingUser && (
            <div className="mt-6">
              {userEmail ? (
              <div className="theme-feedback theme-feedback-success rounded-2xl border p-4 text-center">
                <p className="text-sm font-bold">
                  אתה מחובר למערכת
                </p>
                <p className="theme-muted mt-1 text-xs">
                  לניהול החשבון או התנתקות לחץ על האייקון למעלה
                </p>
              </div>
              ) : (
                <Link
                  href="/login"
                  onClick={saveRedirectBeforeLogin}
                  className="theme-login-cta block w-full rounded-2xl border bg-white px-5 py-4 text-center font-black text-slate-950 shadow-lg shadow-black/20 transition hover:scale-[1.02]"
                >
                  התחבר / הירשם
                </Link>
            )}
            </div>
          )}

          <div className="mt-8 space-y-4">
            {myLeagues.length === 1 && lastLeagueCode && (
            <Link
              href={`/league/${lastLeagueCode}`}
              className="block w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 text-center font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600"
            >
              {lastLeagueName
                ? `המשך לליגה: ${lastLeagueName}`
                : "המשך לליגה שלך"}
            </Link>
          )}

          {myLeagues.length > 1 && (
            <div className="theme-feedback theme-feedback-success rounded-2xl border p-4">
              <label className="mb-2 block text-sm font-bold">
                הליגות שלי
              </label>

              <select
                value={selectedLeagueCode}
                onChange={(event) => setSelectedLeagueCode(event.target.value)}
                className="theme-input w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none focus:border-green-400"
              >
                {myLeagues.map((league) => (
                  <option key={league.leagueId} value={league.leagueCode}>
                    {league.leagueName} — {league.playerName}
                  </option>
                ))}
              </select>

              <Link
                href={
                  selectedLeagueCode
                    ? `/league/${selectedLeagueCode}`
                    : "/"
                }
                className="mt-3 block w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 text-center font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600"
              >
                כניסה לליגה שנבחרה
              </Link>
            </div>
          )}

            <Link
              href="/create-league"
              className="block w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 px-5 py-4 text-center font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600"
            >
              צור ליגה חדשה
            </Link>

            <Link
              href="/join-league"
              className="theme-neutral-button block w-full rounded-2xl border px-5 py-4 text-center font-bold transition hover:scale-[1.02]"
            >
              הצטרף לליגה עם קוד
            </Link>
          </div>

          <InstallAppHelp />

          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            <div className="theme-panel theme-entry-panel rounded-2xl p-3 border">
              <p className="theme-home-pick-home text-2xl font-black">1</p>
              <p className="theme-muted text-xs mt-1">בית</p>
            </div>

            <div className="theme-panel theme-entry-panel rounded-2xl p-3 border">
              <p className="theme-home-pick-draw text-2xl font-black">X</p>
              <p className="theme-muted text-xs mt-1">תיקו</p>
            </div>

            <div className="theme-panel theme-entry-panel rounded-2xl p-3 border">
              <p className="theme-home-pick-away text-2xl font-black">2</p>
              <p className="theme-muted text-xs mt-1">חוץ</p>
            </div>
          </div>
        </div>

        <p className="theme-muted mt-5 text-center text-xs">
          Built for friends, football and bragging rights ⚽
        </p>
      </div>
    </main>
  );
}
