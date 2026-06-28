"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import ThemeToggle from "@/components/theme/ThemeToggle";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type UserMenuProps = {
  email: string;
  onSignedOut?: () => void;
  showToast?: (
    message: string,
    type?: "success" | "error" | "warning" | "info"
  ) => void;
};

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

export default function UserMenu({
  email,
  onSignedOut,
  showToast,
}: UserMenuProps) {
  const supabase = createClient();
  const { t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      showToast?.(t("common.signOutError"), "error");
      setIsSigningOut(false);
      return;
    }

    clearAppLocalStorage();

    setIsOpen(false);
    setIsSigningOut(false);

    showToast?.(t("common.signedOut"), "success");

    if (onSignedOut) {
      onSignedOut();
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
      <button
        type="button"
        title={t("common.account")}
        onClick={() => setIsOpen((current) => !current)}
        className="theme-neutral-button flex h-11 w-11 items-center justify-center rounded-full border text-xl shadow-lg shadow-black/30 backdrop-blur transition hover:scale-105"
      >
        👤
      </button>

      {isOpen && (
        <div className="theme-popover absolute end-0 mt-3 w-64 rounded-2xl border p-4 text-start backdrop-blur">
          <p className="theme-muted mb-1 text-xs">{t("common.connectedAs")}</p>

          <p className="theme-success-text mb-4 break-all text-sm font-bold" dir="ltr">
            <bdi>{email}</bdi>
          </p>
          <div className="mb-4 flex justify-end">
            <ThemeToggle />
          </div>
          <div className="mb-4 flex justify-end">
            <LanguageToggle />
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={isSigningOut}
            className="theme-disabled-control w-full rounded-xl bg-gradient-to-r from-red-500 to-rose-700 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.02] disabled:hover:scale-100"
          >
            {isSigningOut ? t("common.signingOut") : t("common.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
