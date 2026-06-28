"use client";

import { useState } from "react";
import AuthCard from "@/components/auth/AuthCard";
import AuthToast, { ToastState, ToastType } from "@/components/auth/AuthToast";
import LanguageToggle from "@/components/i18n/LanguageToggle";

export default function LoginPage() {
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  return (
    <main className="theme-entry-page theme-page relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute start-4 top-4 z-20 sm:start-6 sm:top-6">
        <LanguageToggle />
      </div>
      <AuthToast toast={toast} />

      <AuthCard showToast={showToast} />
    </main>
  );
}
