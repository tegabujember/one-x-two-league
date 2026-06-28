"use client";

import GoogleLoginButton from "./GoogleLoginButton";
import EmailLoginForm from "./EmailLoginForm";
import type { ToastType } from "./AuthToast";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type AuthCardProps = {
  showToast: (message: string, type?: ToastType) => void;
};

export default function AuthCard({ showToast }: AuthCardProps) {
  const { t } = useLanguage();

  return (
    <div className="theme-card theme-entry-card w-full max-w-md rounded-3xl border p-6 text-center backdrop-blur-xl">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600">
        <span className="text-3xl">🏆</span>
      </div>

      <h1 className="mb-3 text-3xl font-black">{t("auth.title")}</h1>

      <p className="theme-muted mb-6 text-sm leading-6">
        {t("auth.description")}
      </p>

      <GoogleLoginButton showToast={showToast} />

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        <span className="theme-muted text-xs font-bold">{t("auth.or")}</span>
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      </div>

      <EmailLoginForm showToast={showToast} />

      <p className="theme-muted mt-5 text-xs leading-5">
        {t("auth.methodsHelp")}
      </p>
    </div>
  );
}
