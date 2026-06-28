import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import LeagueClient from "@/components/LeagueClient";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
} from "@/lib/i18n/config";
import { he } from "@/lib/i18n/dictionaries/he";
import { en } from "@/lib/i18n/dictionaries/en";

type LeaguePageProps = {
  params: Promise<{
    code: string;
  }>;
  searchParams: Promise<{
    stage?: string | string[];
  }>;
};

export default async function LeaguePage({
  params,
  searchParams,
}: LeaguePageProps) {
  const { code: rawCode } = await params;
  const { stage: requestedStageParam } = await searchParams;
  const code = rawCode.toUpperCase();
  const storedLanguage = (await cookies()).get(LANGUAGE_STORAGE_KEY)?.value;
  const language = isLanguage(storedLanguage)
    ? storedLanguage
    : DEFAULT_LANGUAGE;
  const dictionary = language === "en" ? en : he;

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("code", code)
    .single();

  if (leagueError || !league) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800 text-center">
          <h1 className="text-2xl font-bold mb-4">
            {dictionary["league.notFoundTitle"]}
          </h1>

          <p className="text-slate-400 mb-6">
            {dictionary["league.notFoundDescription"]}
          </p>

          <Link
            href="/"
            className="block rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700"
          >
            {dictionary["common.home"]}
          </Link>
        </div>
      </main>
    );
  }

  const { data: players } = await supabase
    .from("players")
    .select("id, league_id, name, user_id")
    .eq("league_id", league.id)
    .order("created_at", { ascending: true });

  const { data: stages } = await supabase
    .from("league_stages")
    .select(
      "id, league_id, stage_code, display_name, sort_order, predictions_locked, admin_edit_mode"
    )
    .eq("league_id", league.id)
    .order("sort_order", { ascending: true });

  const activeStage = (stages || []).find(
    (stage) => stage.id === league.active_stage_id
  );

  const visibleStages = activeStage
    ? (stages || []).filter(
        (stage) => stage.sort_order <= activeStage.sort_order
      )
    : [];

  const requestedStageCode =
    typeof requestedStageParam === "string" ? requestedStageParam : "";

  const selectedStage =
    visibleStages.find((stage) => stage.stage_code === requestedStageCode) ||
    activeStage;

  if (!selectedStage) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-800 text-center">
          <h1 className="text-2xl font-bold mb-4">
            {dictionary["league.stageNotFoundTitle"]}
          </h1>
          <p className="text-slate-400 mb-6">
            {dictionary["league.stageNotFoundDescription"]}
          </p>
          <Link
            href="/"
            className="block rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700"
          >
            {dictionary["common.home"]}
          </Link>
        </div>
      </main>
    );
  }

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("league_id", league.id)
    .eq("stage_id", selectedStage.id)
    .order("start_time", { ascending: true });

  const matchIds = (matches || []).map((match) => match.id);

  const predictionsResult =
    matchIds.length > 0
      ? await supabase
          .from("predictions")
          .select("*")
          .in("match_id", matchIds)
      : { data: [] };

  const predictions = predictionsResult.data;

  return (
    <LeagueClient
      key={selectedStage.id}
      league={{
        ...league,
        predictions_locked: Boolean(selectedStage.predictions_locked),
        admin_edit_mode: Boolean(selectedStage.admin_edit_mode),
      }}
      players={players || []}
      matches={matches || []}
      predictions={predictions || []}
      stages={visibleStages}
      selectedStage={selectedStage}
      activeStageId={league.active_stage_id}
    />
  );
}
