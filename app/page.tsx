"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [lastLeagueCode, setLastLeagueCode] = useState("");

  useEffect(() => {
    const savedLeagueCode = localStorage.getItem("last-league-code");

    if (savedLeagueCode) {
      setLastLeagueCode(savedLeagueCode);
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800">
        <h1 className="text-3xl font-bold text-center mb-2">
          1X2 League
        </h1>

        <p className="text-slate-400 text-center mb-8">
          טורניר ניחושים פשוט לחברים
        </p>

        <div className="space-y-4">
          {lastLeagueCode && (
            <Link
              href={`/league/${lastLeagueCode}`}
              className="block text-center w-full rounded-xl bg-green-700 py-3 font-semibold hover:bg-green-800"
            >
              המשך לליגה האחרונה
            </Link>
          )}

          <Link
            href="/create-league"
            className="block text-center w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700"
          >
            צור ליגה חדשה
          </Link>

          <Link
            href="/join-league"
            className="block text-center w-full rounded-xl bg-slate-800 py-3 font-semibold hover:bg-slate-700"
          >
            הצטרף לליגה עם קוד
          </Link>
        </div>
      </div>
    </main>
  );
}