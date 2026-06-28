"use client";

import { useState } from "react";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

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
      showToast(t("reset.required"), "warning");
      return;
    }

    if (password.length < 6) {
      showToast(t("reset.tooShort"), "warning");
      return;
    }

    if (password !== confirmPassword) {
      showToast(t("reset.mismatch"), "warning");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setIsSaving(false);

    if (error) {
      console.error(error);
      showToast(t("reset.error"), "error");
      return;
    }

    showToast(t("reset.success"), "success");

    window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 900);
  }

  return (
    <main className="theme-entry-page theme-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AuthToast toast={toast} />
      <div className="absolute start-4 top-4 z-20 sm:start-6 sm:top-6">
        <LanguageToggle />
      </div>

      <div className="theme-entry-decoration absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />

      <div className="theme-card theme-entry-card relative w-full max-w-md rounded-3xl border p-6 text-center backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600">
          <span className="text-3xl">🔐</span>
        </div>

        <h1 className="text-3xl font-black">{t("reset.title")}</h1>

        <p className="theme-muted mt-3 text-sm leading-6">
          {t("reset.description")}
        </p>

        <form onSubmit={handleResetPassword} className="mt-6 space-y-4 text-start">
          <div>
            <label className="theme-muted mb-2 block text-sm font-semibold">
              {t("reset.newPassword")}
            </label>

            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("reset.passwordPlaceholder")}
              autoComplete="new-password"
              className="theme-input w-full rounded-2xl border px-4 py-4 text-left outline-none transition focus:border-green-400"
            />
          </div>

          <div>
            <label className="theme-muted mb-2 block text-sm font-semibold">
              {t("reset.confirmPassword")}
            </label>

            <input
              type="password"
              dir="ltr"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t("reset.confirmPlaceholder")}
              autoComplete="new-password"
              className="theme-input w-full rounded-2xl border px-4 py-4 text-left outline-none transition focus:border-green-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="theme-disabled-control w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 disabled:hover:scale-100"
          >
            {isSaving ? t("reset.saving") : t("reset.submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
