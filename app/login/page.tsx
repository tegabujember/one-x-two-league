"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  message: string;
  type: ToastType;
};

function getSafeRedirect(value: string | null) {
  if (!value) return "/";

  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";

  return value;
}

export default function LoginPage() {
  const supabase = createClient();
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  async function signInWithGoogle() {
    const origin = window.location.origin;

    const params = new URLSearchParams(window.location.search);
    const nextFromUrl = params.get("next");
    const nextFromStorage = localStorage.getItem("redirect-after-login");

    const redirectAfterLogin = getSafeRedirect(nextFromUrl || nextFromStorage);

    localStorage.setItem("redirect-after-login", redirectAfterLogin);

    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("next", redirectAfterLogin);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      console.error(error);
      showToast("שגיאה בהתחברות עם Google", "error");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
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

      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600">
          <span className="text-3xl">🏆</span>
        </div>

        <h1 className="text-3xl font-black mb-3">התחברות</h1>

        <p className="text-sm text-slate-400 mb-6">
          התחבר עם Google כדי לשמור את הליגות והניחושים שלך בכל מכשיר.
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="w-full rounded-2xl bg-white px-5 py-4 font-bold text-slate-950 transition hover:scale-[1.02]"
        >
          התחבר / הירשם עם Google
        </button>
      </div>
    </main>
  );
}