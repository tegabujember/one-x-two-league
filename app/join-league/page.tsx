"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";

type Player = {
  id: string;
  league_id: string;
  name: string;
  user_id: string | null;
};

type PlayerResponse = {
  player: Player;
  alreadyJoined: boolean;
};

type ExistingPlayerResponse = {
  player: Player | null;
  alreadyJoined: boolean;
};

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  message: string;
  type: ToastType;
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

function getSafeJoinRedirect(code: string) {
  const cleanCode = getCleanLeagueCode(code);

  if (!cleanCode) {
    return "/join-league";
  }

  return `/join-league?code=${encodeURIComponent(cleanCode)}`;
}

export default function JoinLeaguePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [playerName, setPlayerName] = useState("");
  const [leagueCode, setLeagueCode] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [isCheckingExistingPlayer, setIsCheckingExistingPlayer] =
    useState(false);
  const [autoLoginMessage, setAutoLoginMessage] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code");

    if (codeFromUrl) {
      const cleanCode = getCleanLeagueCode(codeFromUrl);

      if (cleanCode) {
        setLeagueCode(cleanCode);
      } else {
        setLeagueCode("");
        localStorage.removeItem("redirect-after-login");

        setAutoLoginMessage(
          "קישור ההזמנה לא תקין. צריך להשתמש בקוד ליגה קצר, לדוגמה UL9D3."
        );
      }
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

  useEffect(() => {
    const safeLeagueCode = getCleanLeagueCode(leagueCode);

    if (!userId || !safeLeagueCode) {
      return;
    }

    let isCancelled = false;

    async function checkExistingPlayer() {
      const cleanCode = safeLeagueCode;

      setIsCheckingExistingPlayer(true);
      setAutoLoginMessage("בודק אם כבר הצטרפת לליגה הזאת...");

      try {
        const response = await fetch(
          `/api/leagues/${encodeURIComponent(cleanCode)}/players`,
          {
            method: "GET",
          }
        );

        if (!response.ok) {
          if (!isCancelled) {
            setAutoLoginMessage("");
            setIsCheckingExistingPlayer(false);
          }

          return;
        }

        const data = (await response.json()) as ExistingPlayerResponse;

        if (isCancelled) {
          return;
        }

        if (data.player) {
          localStorage.setItem("last-league-code", cleanCode);
          localStorage.setItem(`selected-player-${cleanCode}`, data.player.id);
          localStorage.removeItem("redirect-after-login");

          setAutoLoginMessage(
            `מצאנו את השחקן שלך (${data.player.name}). מעביר אותך לליגה...`
          );

          setTimeout(() => {
            router.replace(`/league/${encodeURIComponent(cleanCode)}`);
          }, 900);

          return;
        }

        setAutoLoginMessage("");
        setIsCheckingExistingPlayer(false);
      } catch (error) {
        console.error(error);

        if (!isCancelled) {
          setAutoLoginMessage("");
          setIsCheckingExistingPlayer(false);
        }
      }
    }

    checkExistingPlayer();

    return () => {
      isCancelled = true;
    };
  }, [userId, leagueCode, router]);

  function showToast(message: string, type: ToastType = "info") {
  setToast({ message, type });

  window.setTimeout(() => {
    setToast(null);
  }, 3000);
}

  function saveRedirectBeforeLogin() {
  const cleanCode = getCleanLeagueCode(leagueCode);
  const redirectPath = getSafeJoinRedirect(cleanCode);

  localStorage.setItem("redirect-after-login", redirectPath);

  if (cleanCode) {
    localStorage.setItem("last-league-code", cleanCode);
  }
}

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanCode = getCleanLeagueCode(leagueCode);

    if (!userId) {
      showToast("כדי להצטרף לליגה צריך להתחבר עם Google", "warning");
      saveRedirectBeforeLogin();
      router.push(
        `/login?next=${encodeURIComponent(getSafeJoinRedirect(cleanCode))}`
      );
      return;
    }

    if (!playerName.trim() || !cleanCode) {
      showToast("צריך למלא שם וקוד ליגה", "warning");
      return;
    }

    setIsLoading(true);

    const response = await fetch(
      `/api/leagues/${encodeURIComponent(cleanCode)}/players`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playerName.trim(),
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(errorData);

      if (response.status === 401) {
        showToast("צריך להתחבר עם Google כדי להצטרף לליגה", "warning");
        saveRedirectBeforeLogin();
        router.push(
          `/login?next=${encodeURIComponent(getSafeJoinRedirect(cleanCode))}`
        );
      } else if (response.status === 404) {
        showToast("לא נמצאה ליגה עם הקוד הזה", "error");
      } else {
        showToast("שגיאה בהצטרפות לליגה", "error");
      }

      setIsLoading(false);
      return;
    }

    const data = (await response.json()) as PlayerResponse;

    localStorage.setItem("last-league-code", cleanCode);
    localStorage.setItem(`selected-player-${cleanCode}`, data.player.id);
    localStorage.removeItem("redirect-after-login");

    router.push(`/league/${encodeURIComponent(cleanCode)}`);
  }

  const isFormDisabled =
    !userId || isCheckingUser || isCheckingExistingPlayer || isLoading;

  const loginHref = `/login?next=${encodeURIComponent(
    getSafeJoinRedirect(leagueCode)
  )}`;

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative flex items-center justify-center px-4 py-10">
      {toast && (
        <div className="fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
          <div
            className={`rounded-2xl border px-4 py-3 text-center text-sm font-bold shadow-2xl backdrop-blur-xl ${
              toast.type === "success"
                ? "border-green-400/30 bg-green-500/20 text-green-100"
                : toast.type === "error"
                  ? "border-red-400/30 bg-red-500/20 text-red-100"
                  : toast.type === "warning"
                    ? "border-yellow-400/30 bg-yellow-500/20 text-yellow-100"
                    : "border-blue-400/30 bg-blue-500/20 text-blue-100"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
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
              <p className="mt-1 break-all text-sm font-bold text-green-300">
                {userEmail}
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-center">
              <p className="text-sm text-red-200">
                כדי להצטרף לליגה צריך להתחבר עם Google.
              </p>

              <Link
                href={loginHref}
                onClick={saveRedirectBeforeLogin}
                className="mt-4 block rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.02]"
              >
                התחבר / הירשם עם Google
              </Link>
            </div>
          )}

          {autoLoginMessage && (
            <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-center">
              <p className="text-sm font-semibold text-blue-100">
                {autoLoginMessage}
              </p>
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
                disabled={isFormDisabled}
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
                onChange={(event) => setLeagueCode(event.target.value.trim())}
                placeholder="לדוגמה: AB72K"
                disabled={isFormDisabled}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-center text-xl font-black tracking-widest text-green-300 outline-none transition placeholder:text-slate-600 focus:border-green-400 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isFormDisabled}
              className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isCheckingExistingPlayer
                ? "בודק שחקן קיים..."
                : isLoading
                  ? "מצטרף לליגה..."
                  : "הצטרף לליגה"}
            </button>
          </form>

          {leagueCode && (
            <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-500/10 p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">אתה מצטרף לליגה</p>
              <p className="break-words text-2xl font-black tracking-widest text-green-300">
                {leagueCode}
              </p>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
            <p className="text-sm leading-6 text-yellow-100">
              אם כבר הצטרפת בעבר עם חשבון Google הזה, נחבר אותך אוטומטית
              לשחקן הקיים שלך.
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