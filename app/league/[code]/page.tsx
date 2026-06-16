import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LeagueClient from "@/components/LeagueClient";

type LeaguePageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("code", code)
    .single();

  if (leagueError || !league) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800 text-center">
          <h1 className="text-2xl font-bold mb-4">הליגה לא נמצאה</h1>

          <p className="text-slate-400 mb-6">
            לא קיימת ליגה עם הקוד הזה.
          </p>

          <Link
            href="/"
            className="block rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700"
          >
            חזור לדף הבית
          </Link>
        </div>
      </main>
    );
  }

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("league_id", league.id)
    .order("created_at", { ascending: true });

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("league_id", league.id)
    .order("start_time", { ascending: true });

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*");

  return (
    <LeagueClient
      league={league}
      players={players || []}
      matches={matches || []}
      predictions={predictions || []}
    />
  );
}