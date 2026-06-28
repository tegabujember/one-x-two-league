"use client";

import { createClient } from "@/lib/supabaseBrowser";
import { getGoogleCallbackUrl } from "@/lib/authRedirect";
import type { ToastType } from "./AuthToast";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type GoogleLoginButtonProps = {
  showToast: (message: string, type?: ToastType) => void;
};

export default function GoogleLoginButton({
  showToast,
}: GoogleLoginButtonProps) {
  const supabase = createClient();
  const { t } = useLanguage();

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
    showToast(t("auth.googleError"), "error");
  }
}
  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      className="theme-auth-provider-button w-full rounded-2xl border bg-white px-5 py-4 font-bold text-slate-950 transition hover:scale-[1.02]"
    >
      {t("auth.google")}
    </button>
  );
}
