"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import UserMenu from "@/components/auth/UserMenu";
import AuthToast from "@/components/auth/AuthToast";

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

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  message: string;
  type: ToastType;
};

export default function CreateLeaguePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [leagueName, setLeagueName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

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

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  function saveCreateLeagueRedirect() {
  localStorage.setItem("redirect-after-login", "/create-league");
}

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showToast("כדי ליצור ליגה צריך להתחבר או להירשם", "warning");
      localStorage.setItem("redirect-after-login", "/create-league");
      router.push("/login?next=/create-league");
      return;
    }

    if (!leagueName.trim() || !adminName.trim()) {
      showToast("צריך למלא שם ליגה ואת השם שלך", "warning");
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
        showToast("כדי ליצור ליגה צריך להתחבר או להירשם", "warning");
        localStorage.setItem("redirect-after-login", "/create-league");
        router.push("/login?next=/create-league");
      } else {
        showToast("שגיאה ביצירת הליגה", "error");
      }

      setIsLoading(false);
      return;
    }

    const data = (await response.json()) as CreateLeagueResponse;

    localStorage.setItem(`league-admin-${data.league.code}`, data.admin_code);
    localStorage.setItem("last-league-code", data.league.code);
    localStorage.setItem(`selected-player-${data.league.code}`, data.player.id);

    router.push(`/league/${data.league.code}`);
  }

  return (
    <main className="theme-entry-page theme-page min-h-screen overflow-hidden relative flex items-center justify-center px-4 py-10">
      {userEmail && (
          <UserMenu
            email={userEmail}
            showToast={showToast}
            onSignedOut={() => {
              setUserEmail("");
              setLeagueName("");
              setAdminName("");
              router.refresh();
            }}
          />
        )}
      <AuthToast toast={toast} />

      <div className="theme-entry-decoration absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />
      <div className="theme-entry-decoration absolute top-10 left-8 h-24 w-24 rounded-full bg-green-500/20 blur-3xl" />
      <div className="theme-entry-decoration absolute bottom-10 right-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-4xl">🏆</span>
          </div>

          <p className="theme-brand-accent theme-entry-kicker text-sm font-semibold tracking-[0.35em]">
            CREATE LEAGUE
          </p>
        </div>

        <div className="theme-card theme-entry-card rounded-3xl border p-6 backdrop-blur-xl">
          <h1 className="text-center text-3xl font-black tracking-tight">
            צור ליגה חדשה
          </h1>

          <p className="theme-muted mt-3 text-center text-sm leading-6">
            פתח ליגת ניחושים, קבל קוד מנהל, ושתף את הלינק לחברים.
          </p>

          {isCheckingUser ? (
            <div className="theme-panel theme-entry-panel mt-6 rounded-2xl border p-4 text-center">
              <p className="theme-muted text-sm">בודק התחברות...</p>
            </div>
          ) : userEmail ? (
            <div className="theme-feedback theme-feedback-success mt-6 rounded-2xl border p-4 text-center">
              <p className="theme-muted text-xs">מחובר למערכת</p>
              <p className="mt-1 break-all text-sm font-bold">
                {userEmail}
              </p>
            </div>
          ) : (
            <div className="theme-feedback theme-feedback-auth-required mt-6 rounded-2xl border p-4 text-center">
              <p className="text-sm">
                כדי ליצור ליגה צריך להתחבר או להירשם.
              </p>

              <Link
                href="/login?next=/create-league"
                onClick={saveCreateLeagueRedirect}
                className="theme-login-cta mt-4 block rounded-xl border bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.02]"
              >
                התחבר / הירשם
              </Link>
            </div>
          )}

          {userEmail && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="theme-muted mb-2 block text-sm font-semibold">
                  שם הליגה
                </label>

                <input
                  type="text"
                  value={leagueName}
                  onChange={(event) => setLeagueName(event.target.value)}
                  placeholder="לדוגמה: מונדיאל חברים"
                  disabled={!userEmail || isCheckingUser}
                  className="theme-disabled-control theme-input w-full rounded-2xl border px-4 py-4 outline-none transition focus:border-green-400"
                />
              </div>

              <div>
                <label className="theme-muted mb-2 block text-sm font-semibold">
                  השם שלך
                </label>

                <input
                  type="text"
                  value={adminName}
                  onChange={(event) => setAdminName(event.target.value)}
                  placeholder="לדוגמה: Tegabu"
                  disabled={!userEmail || isCheckingUser}
                  className="theme-disabled-control theme-input w-full rounded-2xl border px-4 py-4 outline-none transition focus:border-green-400"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || isCheckingUser || !userEmail}
                className="theme-disabled-control w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 px-5 py-4 font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:hover:scale-100"
              >
                {isLoading ? "יוצר ליגה..." : "צור ליגה"}
              </button>
            </form>
          )}

          <div className="theme-feedback theme-feedback-warning mt-6 rounded-2xl border p-4">
            <p className="text-sm leading-6">
             יצירת הליגה מתבצעת עכשיו דרך API מאובטח. הליגה תיקשר לחשבון
שלך והשחקן הראשון ייווצר עבורך אוטומטית.
            </p>
          </div>

          <Link
            href="/"
            className="theme-accent-link theme-muted mt-6 block text-center text-sm"
          >
            חזור לדף הבית
          </Link>
        </div>
      </div>
    </main>
  );
}
