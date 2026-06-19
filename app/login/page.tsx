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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <AuthToast toast={toast} />

      <AuthCard showToast={showToast} />
    </main>
  );
}