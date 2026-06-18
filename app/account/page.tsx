"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowser";

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setEmail(user.email);
      }

      setIsLoading(false);
    }

    loadUser();
  }, [supabase]);

  async function signOut() {
    const shouldSignOut = confirm("אתה בטוח שאתה רוצה להתנתק?");

    if (!shouldSignOut) {
      return;
    }

    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      alert("שגיאה בהתנתקות");
      setIsSigningOut(false);
      return;
    }

    router.replace("/");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.24),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.22),_transparent_35%)]" />

        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-3xl">👤</span>
          </div>

          <p className="text-slate-300 font-semibold">טוען חשבון...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white relative px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.20),_transparent_32%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.18),_transparent_34%)]" />
      <div className="absolute top-10 left-8 h-20 w-20 rounded-full bg-green-500/20 blur-3xl" />
      <div className="absolute bottom-10 right-8 h-24 w-24 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl shadow-yellow-900/30">
            <span className="text-3xl">👤</span>
          </div>

          <p className="text-[10px] font-semibold tracking-[0.35em] text-green-300">
            ACCOUNT
          </p>

          <h1 className="mt-2 text-3xl font-black">החשבון שלי</h1>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          {email ? (
            <>
              <p className="mb-2 text-sm text-slate-400">מחובר בתור</p>

              <div className="mb-5 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
                <p className="break-all text-base font-bold text-green-300">
                  {email}
                </p>
              </div>

              <button
                type="button"
                onClick={signOut}
                disabled={isSigningOut}
                className="w-full rounded-2xl bg-gradient-to-r from-red-500 to-rose-700 px-5 py-4 text-base font-black shadow-lg shadow-red-950/40 transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSigningOut ? "מתנתק..." : "התנתק"}
              </button>
            </>
          ) : (
            <>
              <p className="mb-5 text-center text-sm leading-6 text-slate-300">
                כרגע אין משתמש מחובר.
              </p>

              <Link
                href="/"
                className="block w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-700 px-5 py-4 text-center text-base font-black shadow-lg shadow-green-950/40 transition hover:scale-[1.02]"
              >
                חזור לדף הבית
              </Link>
            </>
          )}
        </div>

        <Link
          href="/"
          className="mt-5 block text-center text-sm text-slate-400 hover:text-white"
        >
          חזור לדף הבית
        </Link>
      </div>
    </main>
  );
}