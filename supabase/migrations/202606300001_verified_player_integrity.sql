begin;

lock table public.players in share row exclusive mode;

do $preflight$
declare
  invalid_count bigint;
begin
  select count(*)
  into invalid_count
  from public.players as player
  where player.user_id is null;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Verified-player migration aborted: %s public.players rows have a null user_id.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from public.players as player
  where player.name is null
     or regexp_replace(
       player.name,
       E'^[ \\t\\r\\n\\f\\v]+|[ \\t\\r\\n\\f\\v]+$',
       '',
       'g'
     ) = '';

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Verified-player migration aborted: %s public.players rows have a null, blank, or whitespace-only name.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from public.players as player
  left join auth.users as auth_user
    on auth_user.id = player.user_id
  where auth_user.id is null;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Verified-player migration aborted: %s public.players rows reference a missing auth.users row.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from public.players as player
  join auth.users as auth_user
    on auth_user.id = player.user_id
  where auth_user.email_confirmed_at is null;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Verified-player migration aborted: %s public.players rows belong to users whose email is not confirmed.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from (
    select player.league_id, player.user_id
    from public.players as player
    group by player.league_id, player.user_id
    having count(*) > 1
  ) as duplicate_memberships;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Verified-player migration aborted: %s duplicate (league_id, user_id) groups exist in public.players.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from (
    select
      player.league_id,
      lower(
        regexp_replace(
          player.name,
          E'^[ \\t\\r\\n\\f\\v]+|[ \\t\\r\\n\\f\\v]+$',
          '',
          'g'
        )
      ) as normalized_name
    from public.players as player
    group by
      player.league_id,
      lower(
        regexp_replace(
          player.name,
          E'^[ \\t\\r\\n\\f\\v]+|[ \\t\\r\\n\\f\\v]+$',
          '',
          'g'
        )
      )
    having count(*) > 1
  ) as duplicate_names;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Verified-player migration aborted: %s duplicate normalized player-name groups exist within a league.',
        invalid_count
      );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_record.conrelid
     and source_column.attnum = constraint_record.conkey[1]
    join pg_catalog.pg_attribute as target_column
      on target_column.attrelid = constraint_record.confrelid
     and target_column.attnum = constraint_record.confkey[1]
    where constraint_record.contype = 'f'
      and constraint_record.conrelid = 'public.predictions'::regclass
      and constraint_record.confrelid = 'public.players'::regclass
      and pg_catalog.cardinality(constraint_record.conkey) = 1
      and pg_catalog.cardinality(constraint_record.confkey) = 1
      and source_column.attname = 'player_id'
      and target_column.attname = 'id'
      and constraint_record.confdeltype = 'c'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration aborted: predictions.player_id must already reference players.id with ON DELETE CASCADE.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_record.conrelid
     and source_column.attnum = any (constraint_record.conkey)
    where constraint_record.contype = 'f'
      and constraint_record.conrelid = 'public.players'::regclass
      and source_column.attname = 'user_id'
      and pg_catalog.cardinality(constraint_record.conkey) <> 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration aborted: players.user_id participates in a composite foreign key; no unrelated foreign key was changed.';
  end if;

  if pg_catalog.to_regclass('public.players_league_user_uidx') is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration aborted: index public.players_league_user_uidx already exists.';
  end if;

  if pg_catalog.to_regclass('public.players_league_name_ci_uidx') is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration aborted: index public.players_league_name_ci_uidx already exists.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid = 'public.players'::regclass
      and constraint_record.conname = 'players_name_not_blank_check'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration aborted: constraint public.players.players_name_not_blank_check already exists.';
  end if;
end
$preflight$;

alter table public.players
  alter column user_id set not null,
  alter column name set not null;

do $replace_user_foreign_key$
declare
  foreign_key record;
begin
  for foreign_key in
    select constraint_record.conname
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_record.conrelid
     and source_column.attnum = constraint_record.conkey[1]
    where constraint_record.contype = 'f'
      and constraint_record.conrelid = 'public.players'::regclass
      and pg_catalog.cardinality(constraint_record.conkey) = 1
      and source_column.attname = 'user_id'
  loop
    execute format(
      'alter table public.players drop constraint %I',
      foreign_key.conname
    );
  end loop;
end
$replace_user_foreign_key$;

alter table public.players
  add constraint players_user_id_fkey
  foreign key (user_id)
  references auth.users (id)
  on delete cascade
  not valid;

alter table public.players
  validate constraint players_user_id_fkey;

create unique index players_league_user_uidx
  on public.players (league_id, user_id);

create unique index players_league_name_ci_uidx
  on public.players (
    league_id,
    lower(
      regexp_replace(
        name,
        E'^[ \\t\\r\\n\\f\\v]+|[ \\t\\r\\n\\f\\v]+$',
        '',
        'g'
      )
    )
  );

alter table public.players
  add constraint players_name_not_blank_check
  check (
    regexp_replace(
      name,
      E'^[ \\t\\r\\n\\f\\v]+|[ \\t\\r\\n\\f\\v]+$',
      '',
      'g'
    ) <> ''
  );

create function public.require_confirmed_player_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = new.user_id
      and auth_user.email_confirmed_at is null
  ) then
    raise exception using
      errcode = 'PV001',
      message = 'EMAIL_NOT_CONFIRMED',
      detail = 'A player can only be created or updated for an email-confirmed Auth user.';
  end if;

  return new;
end
$function$;

revoke all on function public.require_confirmed_player_user() from public;

create trigger players_require_confirmed_user
before insert or update on public.players
for each row
execute function public.require_confirmed_player_user();

do $postflight$
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.players'::regclass
      and column_record.attname = 'user_id'
      and column_record.attnotnull
  ) or not exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.players'::regclass
      and column_record.attname = 'name'
      and column_record.attnotnull
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration postflight failed: required public.players columns are still nullable.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_record.conrelid
     and source_column.attnum = constraint_record.conkey[1]
    join pg_catalog.pg_attribute as target_column
      on target_column.attrelid = constraint_record.confrelid
     and target_column.attnum = constraint_record.confkey[1]
    where constraint_record.contype = 'f'
      and constraint_record.conrelid = 'public.players'::regclass
      and constraint_record.confrelid = 'auth.users'::regclass
      and pg_catalog.cardinality(constraint_record.conkey) = 1
      and pg_catalog.cardinality(constraint_record.confkey) = 1
      and source_column.attname = 'user_id'
      and target_column.attname = 'id'
      and constraint_record.confdeltype = 'c'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration postflight failed: players.user_id does not cascade from auth.users.id.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_record.conrelid
     and source_column.attnum = constraint_record.conkey[1]
    join pg_catalog.pg_attribute as target_column
      on target_column.attrelid = constraint_record.confrelid
     and target_column.attnum = constraint_record.confkey[1]
    where constraint_record.contype = 'f'
      and constraint_record.conrelid = 'public.predictions'::regclass
      and constraint_record.confrelid = 'public.players'::regclass
      and pg_catalog.cardinality(constraint_record.conkey) = 1
      and pg_catalog.cardinality(constraint_record.confkey) = 1
      and source_column.attname = 'player_id'
      and target_column.attname = 'id'
      and constraint_record.confdeltype = 'c'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration postflight failed: the existing predictions.player_id cascade is no longer intact.';
  end if;

  if pg_catalog.to_regclass('public.players_league_user_uidx') is null
     or pg_catalog.to_regclass('public.players_league_name_ci_uidx') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration postflight failed: a required unique index is missing.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    where trigger_record.tgrelid = 'public.players'::regclass
      and trigger_record.tgname = 'players_require_confirmed_user'
      and not trigger_record.tgisinternal
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Verified-player migration postflight failed: the confirmed-user trigger is missing.';
  end if;
end
$postflight$;

commit;
