"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import AuthToast from "@/components/auth/AuthToast";

type ToastType = "success" | "error" | "warning" | "info";

type ToastState = {
  message: string;
  type: ToastType;
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password) {
      showToast("נא להזין סיסמה חדשה", "warning");
      return;
    }

    if (password.length < 6) {
      showToast("הסיסמה חייבת להכיל לפחות 6 תווים", "warning");
      return;
    }

    if (password !== confirmPassword) {
      showToast("הסיסמאות לא תואמות", "warning");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setIsSaving(false);

    if (error) {
      console.error(error);
      showToast("שגיאה בעדכון הסיסמה", "error");
      return;
    }

    showToast("הסיסמה עודכנה בהצלחה", "success");

    window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 900);
  }

  return (
    <main className="theme-entry-page theme-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AuthToast toast={toast} />

      <div className="theme-entry-decoration absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />

      <div className="theme-card theme-entry-card relative w-full max-w-md rounded-3xl border p-6 text-center backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600">
          <span className="text-3xl">🔐</span>
        </div>

        <h1 className="text-3xl font-black">איפוס סיסמה</h1>

        <p className="theme-muted mt-3 text-sm leading-6">
          הזן סיסמה חדשה לחשבון שלך.
        </p>

        <form onSubmit={handleResetPassword} className="mt-6 space-y-4 text-right">
          <div>
            <label className="theme-muted mb-2 block text-sm font-semibold">
              סיסמה חדשה
            </label>

            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="לפחות 6 תווים"
              autoComplete="new-password"
              className="theme-input w-full rounded-2xl border px-4 py-4 text-left outline-none transition focus:border-green-400"
            />
          </div>

          <div>
            <label className="theme-muted mb-2 block text-sm font-semibold">
              אימות סיסמה
            </label>

            <input
              type="password"
              dir="ltr"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="הקלד שוב את הסיסמה"
              autoComplete="new-password"
              className="theme-input w-full rounded-2xl border px-4 py-4 text-left outline-none transition focus:border-green-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="theme-disabled-control w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 disabled:hover:scale-100"
          >
            {isSaving ? "מעדכן..." : "עדכן סיסמה"}
          </button>
        </form>
      </div>
    </main>
  );
}
