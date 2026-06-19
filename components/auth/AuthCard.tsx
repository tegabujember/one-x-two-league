"use client";

import GoogleLoginButton from "./GoogleLoginButton";
import EmailLoginForm from "./EmailLoginForm";
import type { ToastType } from "./AuthToast";

type AuthCardProps = {
  showToast: (message: string, type?: ToastType) => void;
};

export default function AuthCard({ showToast }: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 text-center shadow-2xl backdrop-blur-xl">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600">
        <span className="text-3xl">🏆</span>
      </div>

      <h1 className="mb-3 text-3xl font-black">התחברות</h1>

      <p className="mb-6 text-sm leading-6 text-slate-400">
        התחבר כדי לשמור את הליגות והניחושים שלך בכל מכשיר.
      </p>

      <GoogleLoginButton showToast={showToast} />

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs font-bold text-slate-500">או</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <EmailLoginForm showToast={showToast} />

      <p className="mt-5 text-xs leading-5 text-slate-500">
        אפשר להתחבר עם Google או עם אימייל וסיסמה. שתי הדרכים שומרות את החשבון
        שלך במערכת.
      </p>
    </div>
  );
}