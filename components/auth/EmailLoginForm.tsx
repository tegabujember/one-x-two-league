"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";
import { getRedirectAfterLogin } from "@/lib/authRedirect";
import type { ToastType } from "./AuthToast";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type EmailLoginFormProps = {
  showToast: (message: string, type?: ToastType) => void;
};

type LoadingAction = "login" | "signup" | "forgot" | null;
type AuthErrorKind =
  | "invalidCredentials"
  | "alreadyRegistered"
  | "rateLimit"
  | "weakPassword"
  | "signupDisabled"
  | "emailNotConfirmed"
  | "generic";

export default function EmailLoginForm({ showToast }: EmailLoginFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  const isLoading = loadingAction !== null;

  function getAuthErrorKind(errorMessage: string): AuthErrorKind {
    const message = errorMessage.toLowerCase();

    if (
      message.includes("invalid login credentials") ||
      message.includes("invalid credentials")
    ) {
      return "invalidCredentials";
    }

    if (
      message.includes("already registered") ||
      message.includes("user already registered") ||
      message.includes("already exists")
    ) {
      return "alreadyRegistered";
    }

    if (
      message.includes("email rate limit exceeded") ||
      message.includes("rate limit")
    ) {
      return "rateLimit";
    }

    if (
      message.includes("password should be at least") ||
      message.includes("password should be at least 6") ||
      message.includes("weak password")
    ) {
      return "weakPassword";
    }

    if (
      message.includes("signup disabled") ||
      message.includes("signups not allowed")
    ) {
      return "signupDisabled";
    }

    if (
      message.includes("email not confirmed") ||
      message.includes("not confirmed")
    ) {
      return "emailNotConfirmed";
    }

    return "generic";
  }

  function getAuthErrorMessage(errorKind: AuthErrorKind) {
    const keys = {
      invalidCredentials: "auth.invalidCredentials",
      alreadyRegistered: "auth.alreadyRegistered",
      rateLimit: "auth.rateLimit",
      weakPassword: "reset.tooShort",
      signupDisabled: "auth.signupDisabled",
      emailNotConfirmed: "auth.emailNotConfirmed",
      generic: "auth.genericError",
    } as const;

    return t(keys[errorKind]);
  }

  function validateEmailOnly() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      showToast(t("auth.emailRequired"), "warning");
      return false;
    }

    if (!cleanEmail.includes("@")) {
      showToast(t("auth.emailInvalid"), "warning");
      return false;
    }

    return true;
  }

  function validateForm() {
    if (!validateEmailOnly()) {
      return false;
    }

    if (!password) {
      showToast(t("auth.passwordRequired"), "warning");
      return false;
    }

    if (password.length < 6) {
      showToast(t("reset.tooShort"), "warning");
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
      showToast(getAuthErrorMessage(getAuthErrorKind(error.message)), "error");
      return;
    }

    showToast(t("auth.loginSuccess"), "success");
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

      const errorKind = getAuthErrorKind(error.message);
      const translatedMessage = getAuthErrorMessage(errorKind);

      if (errorKind === "alreadyRegistered") {
        showToast(translatedMessage, "warning");
        return;
      }

      showToast(translatedMessage, "error");
      return;
    }

    if (!data.session) {
      showToast(t("auth.confirmationSent"), "info");
      return;
    }

    showToast(t("auth.signupSuccess"), "success");
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
      showToast(getAuthErrorMessage(getAuthErrorKind(error.message)), "error");
      return;
    }

    showToast(t("auth.resetSent"), "success");
  }

  return (
    <form
      className="mt-6 space-y-4 text-start"
      onSubmit={(event) => {
        event.preventDefault();
        handleLogin();
      }}
    >
      <div>
        <label className="theme-muted mb-2 block text-sm font-semibold">
          {t("auth.email")}
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
          {t("auth.password")}
        </label>

        <input
          type="password"
          dir="ltr"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("reset.passwordPlaceholder")}
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
          {loadingAction === "login" ? t("auth.loggingIn") : t("auth.login")}
        </button>

        <button
          type="button"
          onClick={handleSignup}
          disabled={isLoading}
          className="theme-disabled-control theme-neutral-button rounded-2xl border px-5 py-4 font-bold transition hover:scale-[1.02] disabled:hover:scale-100"
        >
          {loadingAction === "signup" ? t("auth.signingUp") : t("auth.signup")}
        </button>
      </div>

      <button
        type="button"
        onClick={handleForgotPassword}
        disabled={isLoading}
        className="theme-accent-link theme-disabled-control theme-muted w-full text-center text-sm font-bold transition"
      >
        {loadingAction === "forgot" ? t("auth.sendingEmail") : t("auth.forgotPassword")}
      </button>
    </form>
  );
}
