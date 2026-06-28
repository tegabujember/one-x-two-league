"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { getRedirectAfterLogin } from "@/lib/authRedirect";
import type { ToastType } from "./AuthToast";

type EmailLoginFormProps = {
  showToast: (message: string, type?: ToastType) => void;
};

type LoadingAction = "login" | "signup" | "forgot" | null;

export default function EmailLoginForm({ showToast }: EmailLoginFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  const isLoading = loadingAction !== null;

  function getAuthErrorMessage(errorMessage: string) {
    const message = errorMessage.toLowerCase();

    if (
      message.includes("invalid login credentials") ||
      message.includes("invalid credentials")
    ) {
      return "אימייל או סיסמה לא נכונים";
    }

    if (
      message.includes("already registered") ||
      message.includes("user already registered") ||
      message.includes("already exists")
    ) {
      return "האימייל כבר רשום. נסה להתחבר במקום להירשם.";
    }

    if (
      message.includes("email rate limit exceeded") ||
      message.includes("rate limit")
    ) {
      return "ניסית יותר מדי פעמים. נסה שוב בעוד כמה דקות.";
    }

    if (
      message.includes("password should be at least") ||
      message.includes("password should be at least 6") ||
      message.includes("weak password")
    ) {
      return "הסיסמה חייבת להכיל לפחות 6 תווים";
    }

    if (
      message.includes("signup disabled") ||
      message.includes("signups not allowed")
    ) {
      return "הרשמה עם אימייל לא פעילה כרגע במערכת";
    }

    if (
      message.includes("email not confirmed") ||
      message.includes("not confirmed")
    ) {
      return "צריך לאשר את המייל לפני התחברות";
    }

    return "אירעה שגיאה. נסה שוב.";
  }

  function validateEmailOnly() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      showToast("נא להזין אימייל", "warning");
      return false;
    }

    if (!cleanEmail.includes("@")) {
      showToast("נא להזין אימייל תקין", "warning");
      return false;
    }

    return true;
  }

  function validateForm() {
    if (!validateEmailOnly()) {
      return false;
    }

    if (!password) {
      showToast("נא להזין סיסמה", "warning");
      return false;
    }

    if (password.length < 6) {
      showToast("הסיסמה חייבת להכיל לפחות 6 תווים", "warning");
      return false;
    }

    return true;
  }

  async function handleLogin() {
    if (isLoading) return;
    if (!validateForm()) return;

    setLoadingAction("login");

    const redirectAfterLogin = getRedirectAfterLogin();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoadingAction(null);

    if (error) {
      console.error(error);
      showToast(getAuthErrorMessage(error.message), "error");
      return;
    }

    showToast("התחברת בהצלחה", "success");
    router.push(redirectAfterLogin);
    router.refresh();
  }

  async function handleSignup() {
    if (isLoading) return;
    if (!validateForm()) return;

    setLoadingAction("signup");

    const redirectAfterLogin = getRedirectAfterLogin();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoadingAction(null);

    if (error) {
      console.error(error);

      const translatedMessage = getAuthErrorMessage(error.message);

      if (translatedMessage.includes("כבר רשום")) {
        showToast(translatedMessage, "warning");
        return;
      }

      showToast(translatedMessage, "error");
      return;
    }

    if (!data.session) {
      showToast("נשלח אליך מייל אישור. אשר את החשבון ואז התחבר.", "info");
      return;
    }

    showToast("נרשמת בהצלחה", "success");
    router.push(redirectAfterLogin);
    router.refresh();
  }

  async function handleForgotPassword() {
    if (isLoading) return;
    if (!validateEmailOnly()) return;

    setLoadingAction("forgot");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoadingAction(null);

    if (error) {
      console.error(error);
      showToast(getAuthErrorMessage(error.message), "error");
      return;
    }

    showToast("נשלח אליך מייל לאיפוס סיסמה", "success");
  }

  return (
    <form
      className="mt-6 space-y-4 text-right"
      onSubmit={(event) => {
        event.preventDefault();
        handleLogin();
      }}
    >
      <div>
        <label className="theme-muted mb-2 block text-sm font-semibold">
          אימייל
        </label>

        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          className="theme-input w-full rounded-2xl border px-4 py-4 text-left outline-none transition focus:border-green-400"
        />
      </div>

      <div>
        <label className="theme-muted mb-2 block text-sm font-semibold">
          סיסמה
        </label>

        <input
          type="password"
          dir="ltr"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="לפחות 6 תווים"
          autoComplete="current-password"
          className="theme-input w-full rounded-2xl border px-4 py-4 text-left outline-none transition focus:border-green-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="submit"
          disabled={isLoading}
          className="theme-disabled-control rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 font-bold shadow-lg shadow-green-950/40 transition hover:scale-[1.02] hover:from-green-400 hover:to-emerald-600 disabled:hover:scale-100"
        >
          {loadingAction === "login" ? "מתחבר..." : "התחבר"}
        </button>

        <button
          type="button"
          onClick={handleSignup}
          disabled={isLoading}
          className="theme-disabled-control theme-neutral-button rounded-2xl border px-5 py-4 font-bold transition hover:scale-[1.02] disabled:hover:scale-100"
        >
          {loadingAction === "signup" ? "נרשם..." : "הרשמה"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleForgotPassword}
        disabled={isLoading}
        className="theme-accent-link theme-disabled-control theme-muted w-full text-center text-sm font-bold transition"
      >
        {loadingAction === "forgot" ? "שולח מייל..." : "שכחתי סיסמה"}
      </button>
    </form>
  );
}
