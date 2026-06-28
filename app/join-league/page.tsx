"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import UserMenu from "@/components/auth/UserMenu";
import AuthToast from "@/components/auth/AuthToast";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { useLanguage } from "@/components/i18n/LanguageProvider";

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
  const { t } = useLanguage();

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

      // This intentionally mirrors the original immediate URL-code hydration.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (cleanCode) {
        setLeagueCode(cleanCode);
      } else {
        setLeagueCode("");
        localStorage.removeItem("redirect-after-login");

        setAutoLoginMessage(
          t("join.invalidInvite")
        );
      }
      /* eslint-enable react-hooks/set-state-in-effect */
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
  }, [supabase, t]);

  useEffect(() => {
    const safeLeagueCode = getCleanLeagueCode(leagueCode);

    if (!userId || !safeLeagueCode) {
      return;
    }

    let isCancelled = false;

    async function checkExistingPlayer() {
      const cleanCode = safeLeagueCode;

      setIsCheckingExistingPlayer(true);
      setAutoLoginMessage(t("join.checkingExisting"));

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
            t("join.foundExisting", { name: data.player.name })
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
  }, [userId, leagueCode, router, t]);

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
      showToast(t("join.authRequiredToast"), "warning");
      saveRedirectBeforeLogin();
      router.push(
        `/login?next=${encodeURIComponent(getSafeJoinRedirect(cleanCode))}`
      );
      return;
    }

    if (!playerName.trim() || !cleanCode) {
      showToast(t("join.requiredFields"), "warning");
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
        showToast(t("join.authRequiredToast"), "warning");
        saveRedirectBeforeLogin();
        router.push(
          `/login?next=${encodeURIComponent(getSafeJoinRedirect(cleanCode))}`
        );
      } else if (response.status === 404) {
        showToast(t("join.notFound"), "error");
      } else {
        showToast(t("join.error"), "error");
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
    <main className="theme-entry-page theme-page min-h-screen overflow-hidden relative flex items-center justify-center px-4 py-10">
      {userEmail && (
        <UserMenu
          email={userEmail}
          showToast={showToast}
          onSignedOut={() => {
            setUserId("");
            setUserEmail("");
            setPlayerName("");
            setAutoLoginMessage("");
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
            <span className="text-4xl">⚽</span>
          </div>

          <p className="theme-brand-accent theme-entry-kicker text-sm font-semibold tracking-[0.35em]">
            {t("join.kicker")}
          </p>
        </div>

        <div className="theme-card theme-entry-card rounded-3xl border p-6 backdrop-blur-xl">
          <h1 className="text-center text-3xl font-black tracking-tight">
            {t("join.title")}
          </h1>

          <p className="theme-muted mt-3 text-center text-sm leading-6">
            {t("join.description")}
          </p>

          {isCheckingUser ? (
            <div className="theme-panel theme-entry-panel mt-6 rounded-2xl border p-4 text-center">
              <p className="theme-muted text-sm">{t("common.checkingLogin")}</p>
            </div>
          ) : userId ? (
            <div className="theme-feedback theme-feedback-success mt-6 rounded-2xl border p-4 text-center">
              <p className="theme-muted text-xs">{t("common.connected")}</p>
              <p className="mt-1 break-all text-sm font-bold" dir="ltr">
                <bdi>{userEmail}</bdi>
              </p>
            </div>
          ) : (
            <div className="theme-feedback theme-feedback-auth-required mt-6 rounded-2xl border p-4 text-center">
              <p className="text-sm">
                {t("join.authRequired")}
              </p>

              <Link
                href={loginHref}
                onClick={saveRedirectBeforeLogin}
                className="theme-login-cta mt-4 block rounded-xl border bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.02]"
              >
                {t("common.loginOrSignup")}
              </Link>
            </div>
          )}

          {autoLoginMessage && (
            <div
              className={`theme-feedback mt-6 rounded-2xl border p-4 text-center ${
                leagueCode
                  ? "theme-feedback-info"
                  : "theme-feedback-invalid-invite"
              }`}
            >
              <p className="text-sm font-semibold">
                {autoLoginMessage}
              </p>
            </div>
          )}

          {userId && (
            <>
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label className="theme-muted mb-2 block text-sm font-semibold">
                    {t("join.yourName")}
                  </label>

                  <input
                    type="text"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder={t("common.exampleName")}
                    disabled={isFormDisabled}
                    className="theme-disabled-control theme-input w-full rounded-2xl border px-4 py-4 outline-none transition focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="theme-muted mb-2 block text-sm font-semibold">
                    {t("common.leagueCode")}
                  </label>

                  <input
                    type="text"
                    value={leagueCode}
                    onChange={(event) => setLeagueCode(event.target.value.trim())}
                    placeholder={t("join.codePlaceholder")}
                    dir="ltr"
                    disabled={isFormDisabled}
                    className="theme-disabled-control theme-input theme-league-code w-full rounded-2xl border px-4 py-4 text-center text-xl font-black tracking-widest outline-none transition focus:border-green-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isFormDisabled}
                  className="theme-disabled-control w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 disabled:hover:scale-100"
                >
                  {isCheckingExistingPlayer
                    ? t("join.checkingPlayer")
                    : isLoading
                      ? t("join.joining")
                      : t("join.submit")}
                </button>
              </form>

              {leagueCode && (
                <div className="theme-feedback theme-feedback-success mt-6 rounded-2xl border p-4 text-center">
                  <p className="theme-muted text-xs mb-1">{t("join.joiningLeague")}</p>
                  <p className="theme-league-code break-words text-2xl font-black tracking-widest" dir="ltr">
                    <bdi>{leagueCode}</bdi>
                  </p>
                </div>
              )}
            </>
          )}

          <div className="theme-feedback theme-feedback-warning mt-6 rounded-2xl border p-4">
            <p className="text-sm leading-6">
              {t("join.existingHelp")}
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
