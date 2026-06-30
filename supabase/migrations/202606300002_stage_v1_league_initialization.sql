begin;

do $preflight_relations$
begin
  if pg_catalog.to_regclass('public.leagues') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: required table public.leagues does not exist.';
  end if;

  if pg_catalog.to_regclass('public.league_stages') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: required table public.league_stages does not exist.';
  end if;
end
$preflight_relations$;

lock table public.leagues in share row exclusive mode;
lock table public.league_stages in share row exclusive mode;

do $preflight$
declare
  invalid_count bigint;
  missing_columns text;
begin
  select pg_catalog.string_agg(required_column.column_name, ', ')
  into missing_columns
  from (
    values
      ('id'),
      ('active_stage_id')
  ) as required_column(column_name)
  where not exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.leagues'::regclass
      and column_record.attname = required_column.column_name
      and column_record.attnum > 0
      and not column_record.attisdropped
  );

  if missing_columns is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration aborted: public.leagues is missing required columns: %s.',
        missing_columns
      );
  end if;

  select pg_catalog.string_agg(required_column.column_name, ', ')
  into missing_columns
  from (
    values
      ('id'),
      ('league_id'),
      ('stage_code'),
      ('display_name'),
      ('sort_order'),
      ('predictions_locked'),
      ('admin_edit_mode')
  ) as required_column(column_name)
  where not exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.league_stages'::regclass
      and column_record.attname = required_column.column_name
      and column_record.attnum > 0
      and not column_record.attisdropped
  );

  if missing_columns is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration aborted: public.league_stages is missing required columns: %s.',
        missing_columns
      );
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.leagues'::regclass
      and column_record.attname = 'active_stage_id'
      and column_record.attnotnull
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: public.leagues.active_stage_id must remain nullable for AFTER INSERT initialization.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.league_stages'::regclass
      and column_record.attname = 'stage_code'
      and column_record.atttypid in (
        'pg_catalog.text'::regtype,
        'pg_catalog.varchar'::regtype
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: public.league_stages.stage_code must be text or character varying.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.league_stages'::regclass
      and column_record.attname = 'predictions_locked'
      and column_record.atttypid = 'pg_catalog.bool'::regtype
  ) or not exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.league_stages'::regclass
      and column_record.attname = 'admin_edit_mode'
      and column_record.atttypid = 'pg_catalog.bool'::regtype
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: stage lock columns must be boolean.';
  end if;

  if pg_catalog.to_regprocedure(
    'public.initialize_new_league_stages()'
  ) is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: function public.initialize_new_league_stages() already exists.';
  end if;

  if pg_catalog.to_regprocedure(
    'public.validate_league_active_stage()'
  ) is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: function public.validate_league_active_stage() already exists.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    where trigger_record.tgrelid in (
      'public.leagues'::regclass,
      'public.league_stages'::regclass
    )
      and not trigger_record.tgisinternal
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: an unexpected custom trigger already exists on public.leagues or public.league_stages.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_record
    where index_record.indrelid = 'public.league_stages'::regclass
      and index_record.indisunique
      and index_record.indisvalid
      and index_record.indisready
      and index_record.indpred is null
      and index_record.indexprs is null
      and index_record.indnkeyatts = 2
      and array(
        select column_record.attname
        from pg_catalog.unnest(index_record.indkey)
          with ordinality as index_column(attnum, position)
        join pg_catalog.pg_attribute as column_record
          on column_record.attrelid = index_record.indrelid
         and column_record.attnum = index_column.attnum
        where index_column.position <= index_record.indnkeyatts
        order by index_column.position
      ) = array['league_id', 'stage_code']::name[]
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: valid unique (league_id, stage_code) index or constraint is missing.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_record
    where index_record.indrelid = 'public.league_stages'::regclass
      and index_record.indisunique
      and index_record.indisvalid
      and index_record.indisready
      and index_record.indpred is null
      and index_record.indexprs is null
      and index_record.indnkeyatts = 2
      and array(
        select column_record.attname
        from pg_catalog.unnest(index_record.indkey)
          with ordinality as index_column(attnum, position)
        join pg_catalog.pg_attribute as column_record
          on column_record.attrelid = index_record.indrelid
         and column_record.attnum = index_column.attnum
        where index_column.position <= index_record.indnkeyatts
        order by index_column.position
      ) = array['league_id', 'id']::name[]
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: valid unique (league_id, id) index or constraint is missing.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.contype = 'f'
      and constraint_record.conrelid = 'public.league_stages'::regclass
      and constraint_record.confrelid = 'public.leagues'::regclass
      and constraint_record.convalidated
      and constraint_record.confdeltype = 'c'
      and constraint_record.conkey = array[
        (
          select column_record.attnum
          from pg_catalog.pg_attribute as column_record
          where column_record.attrelid = 'public.league_stages'::regclass
            and column_record.attname = 'league_id'
        )
      ]::smallint[]
      and constraint_record.confkey = array[
        (
          select column_record.attnum
          from pg_catalog.pg_attribute as column_record
          where column_record.attrelid = 'public.leagues'::regclass
            and column_record.attname = 'id'
        )
      ]::smallint[]
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: league_stages.league_id must reference leagues.id with ON DELETE CASCADE.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.contype = 'f'
      and constraint_record.conrelid = 'public.leagues'::regclass
      and constraint_record.confrelid = 'public.league_stages'::regclass
      and constraint_record.convalidated
      and constraint_record.conkey = array[
        (
          select column_record.attnum
          from pg_catalog.pg_attribute as column_record
          where column_record.attrelid = 'public.leagues'::regclass
            and column_record.attname = 'id'
        ),
        (
          select column_record.attnum
          from pg_catalog.pg_attribute as column_record
          where column_record.attrelid = 'public.leagues'::regclass
            and column_record.attname = 'active_stage_id'
        )
      ]::smallint[]
      and constraint_record.confkey = array[
        (
          select column_record.attnum
          from pg_catalog.pg_attribute as column_record
          where column_record.attrelid = 'public.league_stages'::regclass
            and column_record.attname = 'league_id'
        ),
        (
          select column_record.attnum
          from pg_catalog.pg_attribute as column_record
          where column_record.attrelid = 'public.league_stages'::regclass
            and column_record.attname = 'id'
        )
      ]::smallint[]
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration aborted: validated composite active-stage foreign key is missing.';
  end if;

  select count(*)
  into invalid_count
  from (
    select stage.league_id, stage.stage_code
    from public.league_stages as stage
    group by stage.league_id, stage.stage_code
    having count(*) > 1
  ) as duplicate_stage_codes;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration aborted: %s duplicate (league_id, stage_code) groups exist.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from public.league_stages as stage
  where stage.stage_code is null
     or stage.stage_code::text not in (
       'group_stage',
       'round_of_32',
       'round_of_16',
       'quarterfinal',
       'semifinal',
       'third_place',
       'final'
     );

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration aborted: %s league stage rows use a null or noncanonical stage code.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from public.league_stages as stage
  left join public.leagues as league
    on league.id = stage.league_id
  where stage.league_id is null
     or league.id is null;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration aborted: %s league stage rows have a null or missing league.',
        invalid_count
      );
  end if;
end
$preflight$;

with canonical_stages(stage_code, display_name, sort_order) as (
  values
    ('group_stage', 'שלב בתים', 1),
    ('round_of_32', 'האחרונות 32', 2),
    ('round_of_16', 'שמינית גמר', 3),
    ('quarterfinal', 'רבע גמר', 4),
    ('semifinal', 'חצי גמר', 5),
    ('third_place', 'מקום שלישי', 6),
    ('final', 'גמר', 7)
)
insert into public.league_stages (
  league_id,
  stage_code,
  display_name,
  sort_order,
  predictions_locked,
  admin_edit_mode
)
select
  league.id,
  canonical_stage.stage_code,
  canonical_stage.display_name,
  canonical_stage.sort_order,
  false,
  false
from public.leagues as league
cross join canonical_stages as canonical_stage
where not exists (
  select 1
  from public.league_stages as existing_stage
  where existing_stage.league_id = league.id
    and existing_stage.stage_code = canonical_stage.stage_code
);

update public.leagues as league
set active_stage_id = group_stage.id
from public.league_stages as group_stage
where group_stage.league_id = league.id
  and group_stage.stage_code = 'group_stage'
  and (
    league.active_stage_id is null
    or not exists (
      select 1
      from public.league_stages as active_stage
      where active_stage.league_id = league.id
        and active_stage.id = league.active_stage_id
    )
  );

do $backfill_postflight$
declare
  invalid_count bigint;
begin
  select count(*)
  into invalid_count
  from (
    select league.id
    from public.leagues as league
    left join public.league_stages as stage
      on stage.league_id = league.id
    group by league.id
    having count(stage.id) <> 7
       or count(distinct stage.stage_code) <> 7
  ) as incomplete_leagues;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration aborted: backfill left %s leagues without exactly seven canonical stages.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from public.leagues as league
  left join public.league_stages as active_stage
    on active_stage.league_id = league.id
   and active_stage.id = league.active_stage_id
  where league.active_stage_id is null
     or active_stage.id is null;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration aborted: backfill left %s leagues without a valid active stage.',
        invalid_count
      );
  end if;
end
$backfill_postflight$;

create function public.initialize_new_league_stages()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  group_stage_id public.league_stages.id%type;
  inserted_count integer;
  stage_count integer;
begin
  insert into public.league_stages (
    league_id,
    stage_code,
    display_name,
    sort_order,
    predictions_locked,
    admin_edit_mode
  )
  values
    (new.id, 'group_stage', 'שלב בתים', 1, false, false),
    (new.id, 'round_of_32', 'האחרונות 32', 2, false, false),
    (new.id, 'round_of_16', 'שמינית גמר', 3, false, false),
    (new.id, 'quarterfinal', 'רבע גמר', 4, false, false),
    (new.id, 'semifinal', 'חצי גמר', 5, false, false),
    (new.id, 'third_place', 'מקום שלישי', 6, false, false),
    (new.id, 'final', 'גמר', 7, false, false);

  get diagnostics inserted_count = row_count;

  if inserted_count <> 7 then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization failed: exactly seven stages were not inserted for the new league.';
  end if;

  select stage.id
  into group_stage_id
  from public.league_stages as stage
  where stage.league_id = new.id
    and stage.stage_code = 'group_stage';

  if group_stage_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization failed: Group Stage was not created for the new league.';
  end if;

  update public.leagues as league
  set active_stage_id = group_stage_id
  where league.id = new.id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization failed: the new league could not be assigned an active stage.';
  end if;

  select count(*)
  into stage_count
  from public.league_stages as stage
  where stage.league_id = new.id;

  if stage_count <> 7 then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization failed: the new league does not have exactly seven stages.';
  end if;

  return new;
end
$function$;

revoke all on function public.initialize_new_league_stages() from public;

create trigger leagues_initialize_stages_after_insert
after insert on public.leagues
for each row
execute function public.initialize_new_league_stages();

create function public.validate_league_active_stage()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if not exists (
    select 1
    from public.leagues as league
    where league.id = new.id
  ) then
    return null;
  end if;

  if not exists (
    select 1
    from public.leagues as league
    join public.league_stages as active_stage
      on active_stage.league_id = league.id
     and active_stage.id = league.active_stage_id
    where league.id = new.id
      and league.active_stage_id is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Active-stage validation failed: the league must end the transaction with an active stage that belongs to it.';
  end if;

  return null;
end
$function$;

revoke all on function public.validate_league_active_stage() from public;

create constraint trigger leagues_require_valid_active_stage
after insert or update of active_stage_id on public.leagues
deferrable initially deferred
for each row
execute function public.validate_league_active_stage();

do $final_postflight$
declare
  invalid_count bigint;
begin
  if exists (
    select 1
    from pg_catalog.pg_attribute as column_record
    where column_record.attrelid = 'public.leagues'::regclass
      and column_record.attname = 'active_stage_id'
      and column_record.attnotnull
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration postflight failed: active_stage_id was made non-null.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    join pg_catalog.pg_proc as function_record
      on function_record.oid = trigger_record.tgfoid
    where trigger_record.tgrelid = 'public.leagues'::regclass
      and trigger_record.tgname = 'leagues_initialize_stages_after_insert'
      and not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
      and function_record.oid = pg_catalog.to_regprocedure(
        'public.initialize_new_league_stages()'
      )
      and function_record.prosecdef
      and function_record.proconfig @> array['search_path=pg_catalog']::text[]
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration postflight failed: secured initialization trigger is missing or invalid.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    join pg_catalog.pg_proc as function_record
      on function_record.oid = trigger_record.tgfoid
    where trigger_record.tgrelid = 'public.leagues'::regclass
      and trigger_record.tgname = 'leagues_require_valid_active_stage'
      and not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
      and trigger_record.tgdeferrable
      and trigger_record.tginitdeferred
      and function_record.oid = pg_catalog.to_regprocedure(
        'public.validate_league_active_stage()'
      )
      and function_record.prosecdef
      and function_record.proconfig @> array['search_path=pg_catalog']::text[]
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Stage initialization migration postflight failed: deferred active-stage constraint trigger is missing or invalid.';
  end if;

  select count(*)
  into invalid_count
  from (
    select league.id
    from public.leagues as league
    left join public.league_stages as stage
      on stage.league_id = league.id
    group by league.id
    having count(stage.id) <> 7
       or count(distinct stage.stage_code) <> 7
  ) as incomplete_leagues;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration postflight failed: %s leagues do not have exactly seven canonical stages.',
        invalid_count
      );
  end if;

  select count(*)
  into invalid_count
  from public.leagues as league
  left join public.league_stages as active_stage
    on active_stage.league_id = league.id
   and active_stage.id = league.active_stage_id
  where league.active_stage_id is null
     or active_stage.id is null;

  if invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stage initialization migration postflight failed: %s leagues do not have a valid active stage.',
        invalid_count
      );
  end if;
end
$final_postflight$;

commit;
