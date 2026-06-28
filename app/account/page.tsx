"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import AuthToast from "@/components/auth/AuthToast";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  message: string;
  type: ToastType;
};

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setEmail(user.email);
      }

      setIsLoading(false);
    }

    loadUser();
  }, [supabase]);

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  function clearAppLocalStorage() {
    localStorage.removeItem("redirect-after-login");

    Object.keys(localStorage)
      .filter(
        (key) =>
          key.startsWith("selected-player-") ||
          key.startsWith("league-admin-")
      )
      .forEach((key) => localStorage.removeItem(key));
  }

  async function signOut() {
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      showToast(t("common.signOutError"), "error");
      setIsSigningOut(false);
      return;
    }

    clearAppLocalStorage();

    router.replace("/");
  }

  if (isLoading) {
    return (
      <main className="theme-entry-page theme-page min-h-screen overflow-hidden relative flex items-center justify-center px-4">
        <div className="theme-entry-decoration absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />

        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-3xl">👤</span>
          </div>

          <p className="theme-muted font-semibold">{t("account.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="theme-entry-page theme-page min-h-screen overflow-hidden relative px-4 py-8">
      <AuthToast toast={toast} />
      <div className="absolute start-4 top-4 z-20 sm:start-6 sm:top-6">
        <LanguageToggle />
      </div>

      <div className="theme-entry-decoration absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.20),_transparent_32%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.18),_transparent_34%)]" />
      <div className="theme-entry-decoration absolute top-10 left-8 h-20 w-20 rounded-full bg-green-500/20 blur-3xl" />
      <div className="theme-entry-decoration absolute bottom-10 right-8 h-24 w-24 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-3xl">👤</span>
          </div>

          <p className="theme-brand-accent theme-entry-kicker text-[10px] font-semibold tracking-[0.35em]">
            {t("account.kicker")}
          </p>

          <h1 className="mt-2 text-3xl font-black">{t("account.title")}</h1>
        </div>

        <div className="theme-card theme-entry-card rounded-3xl border p-6 backdrop-blur-xl">
          {email ? (
            <>
              <p className="theme-muted mb-2 text-sm">{t("common.connectedAs")}</p>

              <div className="theme-panel theme-entry-panel mb-5 rounded-2xl border px-4 py-4">
                <p className="theme-success-text break-all text-base font-bold" dir="ltr">
                  <bdi>{email}</bdi>
                </p>
              </div>

              {!showSignOutConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  disabled={isSigningOut}
                  className="theme-disabled-control w-full rounded-2xl bg-gradient-to-r from-red-500 to-rose-700 px-5 py-4 text-base font-black shadow-lg shadow-red-950/40 transition hover:scale-[1.02] disabled:hover:scale-100"
                >
                  {t("common.signOut")}
                </button>
              ) : (
                <div className="theme-feedback theme-feedback-error theme-feedback-confirm rounded-2xl border p-4 text-center">
                  <p className="text-sm font-bold">
                    {t("common.signOutConfirm")}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSignOutConfirm(false)}
                      disabled={isSigningOut}
                      className="theme-disabled-control theme-neutral-button rounded-xl border px-4 py-3 text-sm font-bold transition"
                    >
                      {t("common.cancel")}
                    </button>

                    <button
                      type="button"
                      onClick={signOut}
                      disabled={isSigningOut}
                      className="theme-disabled-control rounded-xl bg-gradient-to-r from-red-500 to-rose-700 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.02] disabled:hover:scale-100"
                    >
                      {isSigningOut ? t("common.signingOut") : t("common.yesSignOut")}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="theme-muted mb-5 text-center text-sm leading-6">
                {t("account.noUser")}
              </p>

              <Link
                href="/"
                className="block w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 text-center text-base font-black shadow-lg shadow-green-950/40 transition hover:scale-[1.02]"
              >
                {t("common.home")}
              </Link>
            </>
          )}
        </div>

        <Link
          href="/"
          className="theme-accent-link theme-muted mt-5 block text-center text-sm"
        >
          {t("common.home")}
        </Link>
      </div>
    </main>
  );
}
