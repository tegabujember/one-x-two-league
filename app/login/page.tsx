"use client";

import { useState } from "react";
import AuthCard from "@/components/auth/AuthCard";
import AuthToast, { ToastState, ToastType } from "@/components/auth/AuthToast";

export default function LoginPage() {
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });

    window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  return (
    <main className="theme-entry-page theme-page flex min-h-screen items-center justify-center px-4 py-10">
      <AuthToast toast={toast} />

      <AuthCard showToast={showToast} />
    </main>
  );
}
