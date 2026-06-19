"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";

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

  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      showToast?.("שגיאה בהתנתקות", "error");
      setIsSigningOut(false);
      return;
    }

    clearAppLocalStorage();

    setIsOpen(false);
    setIsSigningOut(false);

    showToast?.("התנתקת בהצלחה", "success");

    if (onSignedOut) {
      onSignedOut();
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
      <button
        type="button"
        title="החשבון שלי"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 text-xl shadow-lg shadow-black/30 backdrop-blur transition hover:scale-105 hover:bg-slate-800"
      >
        👤
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-right shadow-2xl shadow-black/40 backdrop-blur">
          <p className="mb-1 text-xs text-slate-400">מחובר בתור</p>

          <p className="mb-4 break-all text-sm font-bold text-green-300">
            {email}
          </p>
          <button
            type="button"
            onClick={signOut}
            disabled={isSigningOut}
            className="w-full rounded-xl bg-gradient-to-r from-red-500 to-rose-700 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSigningOut ? "מתנתק..." : "התנתק"}
          </button>
        </div>
      )}
    </div>
  );
}