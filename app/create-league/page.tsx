"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import UserMenu from "@/components/auth/UserMenu";
import AuthToast from "@/components/auth/AuthToast";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { useLanguage } from "@/components/i18n/LanguageProvider";

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

type CreateLeagueErrorResponse = {
  code?: "EMAIL_NOT_CONFIRMED" | "PLAYER_NAME_TAKEN" | "ALREADY_IN_LEAGUE";
};

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  message: string;
  type: ToastType;
};

export default function CreateLeaguePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();

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
      showToast(t("create.authRequiredToast"), "warning");
      localStorage.setItem("redirect-after-login", "/create-league");
      router.push("/login?next=/create-league");
      return;
    }

    if (!leagueName.trim() || !adminName.trim()) {
      showToast(t("create.requiredFields"), "warning");
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
      const errorData = (await response
        .json()
        .catch(() => null)) as CreateLeagueErrorResponse | null;
      console.error(errorData);

      if (errorData?.code === "EMAIL_NOT_CONFIRMED") {
        showToast(t("player.emailNotConfirmed"), "warning");
      } else if (errorData?.code === "PLAYER_NAME_TAKEN") {
        showToast(t("player.nameTaken"), "warning");
      } else if (response.status === 401) {
        showToast(t("create.authRequiredToast"), "warning");
        localStorage.setItem("redirect-after-login", "/create-league");
        router.push("/login?next=/create-league");
      } else {
        showToast(t("create.error"), "error");
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
      {!isCheckingUser && !userEmail && (
        <div className="absolute start-4 top-4 z-20 sm:start-6 sm:top-6">
          <LanguageToggle />
        </div>
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
            {t("create.kicker")}
          </p>
        </div>

        <div className="theme-card theme-entry-card rounded-3xl border p-6 backdrop-blur-xl">
          <h1 className="text-center text-3xl font-black tracking-tight">
            {t("create.title")}
          </h1>

          <p className="theme-muted mt-3 text-center text-sm leading-6">
            {t("create.description")}
          </p>

          {isCheckingUser ? (
            <div className="theme-panel theme-entry-panel mt-6 rounded-2xl border p-4 text-center">
              <p className="theme-muted text-sm">{t("common.checkingLogin")}</p>
            </div>
          ) : userEmail ? (
            <div className="theme-feedback theme-feedback-success mt-6 rounded-2xl border p-4 text-center">
              <p className="theme-muted text-xs">{t("common.connected")}</p>
              <p className="mt-1 break-all text-sm font-bold" dir="ltr">
                <bdi>{userEmail}</bdi>
              </p>
            </div>
          ) : (
            <div className="theme-feedback theme-feedback-auth-required mt-6 rounded-2xl border p-4 text-center">
              <p className="text-sm">
                {t("create.authRequired")}
              </p>

              <Link
                href="/login?next=/create-league"
                onClick={saveCreateLeagueRedirect}
                className="theme-login-cta mt-4 block rounded-xl border bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.02]"
              >
                {t("common.loginOrSignup")}
              </Link>
            </div>
          )}

          {userEmail && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="theme-muted mb-2 block text-sm font-semibold">
                  {t("create.leagueName")}
                </label>

                <input
                  type="text"
                  value={leagueName}
                  onChange={(event) => setLeagueName(event.target.value)}
                  placeholder={t("create.leagueNamePlaceholder")}
                  disabled={!userEmail || isCheckingUser}
                  className="theme-disabled-control theme-input w-full rounded-2xl border px-4 py-4 outline-none transition focus:border-green-400"
                />
              </div>

              <div>
                <label className="theme-muted mb-2 block text-sm font-semibold">
                  {t("create.yourName")}
                </label>

                <input
                  type="text"
                  value={adminName}
                  onChange={(event) => setAdminName(event.target.value)}
                  placeholder={t("common.exampleName")}
                  disabled={!userEmail || isCheckingUser}
                  className="theme-disabled-control theme-input w-full rounded-2xl border px-4 py-4 outline-none transition focus:border-green-400"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || isCheckingUser || !userEmail}
                className="theme-disabled-control w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-700 px-5 py-4 font-bold shadow-lg shadow-blue-950/40 transition hover:scale-[1.02] hover:from-blue-400 hover:to-indigo-600 disabled:hover:scale-100"
              >
                {isLoading ? t("create.creating") : t("create.submit")}
              </button>
            </form>
          )}

          <div className="theme-feedback theme-feedback-warning mt-6 rounded-2xl border p-4">
            <p className="text-sm leading-6">
              {t("create.secureApi")}
            </p>
          </div>

          <Link
            href="/"
            className="theme-accent-link theme-muted mt-6 block text-center text-sm"
          >
            {t("common.home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
