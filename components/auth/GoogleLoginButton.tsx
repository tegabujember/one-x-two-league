"use client";

import { createClient } from "@/lib/supabaseBrowser";
import { getGoogleCallbackUrl } from "@/lib/authRedirect";
import type { ToastType } from "./AuthToast";

type GoogleLoginButtonProps = {
  showToast: (message: string, type?: ToastType) => void;
};

export default function GoogleLoginButton({
  showToast,
}: GoogleLoginButtonProps) {
  const supabase = createClient();

  async function signInWithGoogle() {
  const callbackUrl = getGoogleCallbackUrl();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error) {
    console.error(error);
    showToast("שגיאה בהתחברות עם Google", "error");
  }
}
  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      className="theme-auth-provider-button w-full rounded-2xl border bg-white px-5 py-4 font-bold text-slate-950 transition hover:scale-[1.02]"
    >
      התחבר / הירשם עם Google
    </button>
  );
}
