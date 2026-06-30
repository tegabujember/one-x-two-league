import "server-only";

import type { PostgrestError, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabaseServer";

export const PLAYER_ERROR_CODES = {
  emailNotConfirmed: "EMAIL_NOT_CONFIRMED",
  playerNameTaken: "PLAYER_NAME_TAKEN",
  alreadyInLeague: "ALREADY_IN_LEAGUE",
} as const;

type ConfirmedUserResult =
  | { user: User; error: null }
  | { user: null; error: "NOT_AUTHENTICATED" | "EMAIL_NOT_CONFIRMED" };

export async function getConfirmedUser(): Promise<ConfirmedUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "NOT_AUTHENTICATED" };
  }

  if (!user.email_confirmed_at) {
    return { user: null, error: PLAYER_ERROR_CODES.emailNotConfirmed };
  }

  return { user, error: null };
}

export function isEmailNotConfirmedError(error: PostgrestError | null) {
  return error?.code === "PV001";
}

export function isUniqueIndexError(
  error: PostgrestError | null,
  indexName: string
) {
  if (error?.code !== "23505") {
    return false;
  }

  return [error.message, error.details, error.hint].some((value) =>
    value?.includes(indexName)
  );
}
