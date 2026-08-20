alter table plant_id.garden_plants
  drop constraint if exists garden_plants_identity_source_check;

update plant_id.garden_plants
set identity_source = 'ai_accepted'
where identity_source = 'ai_initial';

alter table plant_id.garden_plants
  add constraint garden_plants_identity_source_check
  check (identity_source in ('manual', 'ai_accepted', 'label_confirmed'));

create table if not exists plant_id.ai_assessments (
  id uuid primary key,
  plant_id uuid not null references plant_id.garden_plants(id) on delete restrict,
  common_name text not null default '',
  scientific_name text not null default '',
  confidence numeric,
  result jsonb not null,
  model text not null default '',
  schema_version text not null,
  prompt_version text not null,
  source text not null default 'openai',
  created_at timestamptz not null default now(),
  constraint ai_assessments_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint ai_assessments_source_check check (source in ('openai', 'carried_identification', 'legacy'))
);

create table if not exists plant_id.ai_assessment_photos (
  assessment_id uuid not null references plant_id.ai_assessments(id) on delete cascade,
  photo_id uuid not null references plant_id.garden_photos(id) on delete restrict,
  primary key (assessment_id, photo_id)
);

create table if not exists plant_id.care_guides (
  id uuid primary key,
  plant_id uuid not null references plant_id.garden_plants(id) on delete restrict,
  guide jsonb not null,
  context_snapshot jsonb not null,
  model text not null default '',
  schema_version text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists plant_id.care_guide_photos (
  care_guide_id uuid not null references plant_id.care_guides(id) on delete cascade,
  photo_id uuid not null references plant_id.garden_photos(id) on delete restrict,
  primary key (care_guide_id, photo_id)
);

create table if not exists plant_id.observations (
  id uuid primary key,
  plant_id uuid not null references plant_id.garden_plants(id) on delete restrict,
  description text not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint observations_description_check check (length(trim(description)) > 0)
);

create table if not exists plant_id.observation_photos (
  observation_id uuid not null references plant_id.observations(id) on delete cascade,
  photo_id uuid not null references plant_id.garden_photos(id) on delete restrict,
  primary key (observation_id, photo_id)
);

create table if not exists plant_id.diagnoses (
  id uuid primary key,
  plant_id uuid not null references plant_id.garden_plants(id) on delete restrict,
  diagnosis jsonb not null,
  context_snapshot jsonb not null,
  model text not null default '',
  schema_version text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists plant_id.diagnosis_observations (
  diagnosis_id uuid not null references plant_id.diagnoses(id) on delete cascade,
  observation_id uuid not null references plant_id.observations(id) on delete restrict,
  primary key (diagnosis_id, observation_id)
);

create table if not exists plant_id.diagnosis_photos (
  diagnosis_id uuid not null references plant_id.diagnoses(id) on delete cascade,
  photo_id uuid not null references plant_id.garden_photos(id) on delete restrict,
  primary key (diagnosis_id, photo_id)
);

alter table plant_id.garden_plants
  add column if not exists current_ai_assessment_id uuid references plant_id.ai_assessments(id) on delete set null,
  add column if not exists current_care_guide_id uuid references plant_id.care_guides(id) on delete set null,
  add column if not exists current_diagnosis_id uuid references plant_id.diagnoses(id) on delete set null;

alter table plant_id.garden_photos
  add column if not exists purpose text not null default 'identity_reference';

alter table plant_id.garden_photos
  drop constraint if exists garden_photos_purpose_check;

alter table plant_id.garden_photos
  add constraint garden_photos_purpose_check
  check (purpose in ('identity_reference', 'observation_problem', 'progress_history'));

create index if not exists ai_assessments_plant_created_idx
  on plant_id.ai_assessments (plant_id, created_at desc);
create index if not exists care_guides_plant_created_idx
  on plant_id.care_guides (plant_id, created_at desc);
create index if not exists observations_active_plant_date_idx
  on plant_id.observations (plant_id, observed_at desc) where deleted_at is null;
create index if not exists diagnoses_plant_created_idx
  on plant_id.diagnoses (plant_id, created_at desc);

drop trigger if exists observations_set_updated_at on plant_id.observations;
create trigger observations_set_updated_at
before update on plant_id.observations
for each row execute function plant_id.set_updated_at();

create or replace function plant_id.check_rate_limit(
  p_client_key text,
  p_client_limit integer,
  p_client_window_seconds integer,
  p_global_limit integer,
  p_global_window_seconds integer
)
returns table (success boolean, limit_value integer, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = plant_id, public
as $$
declare
  v_now timestamptz := now();
  v_client_window_start timestamptz;
  v_global_window_start timestamptz;
  v_client_count integer;
  v_global_count integer;
  v_client_reset timestamptz;
  v_global_reset timestamptz;
begin
  if p_client_key is null or p_client_key = '' then raise exception 'client key is required'; end if;
  if p_client_limit < 1 or p_client_window_seconds < 1 or p_global_limit < 1 or p_global_window_seconds < 1 then
    raise exception 'rate-limit values must be positive';
  end if;

  v_client_window_start := to_timestamp(floor(extract(epoch from v_now) / p_client_window_seconds) * p_client_window_seconds);
  v_global_window_start := to_timestamp(floor(extract(epoch from v_now) / p_global_window_seconds) * p_global_window_seconds);
  v_client_reset := v_client_window_start + make_interval(secs => p_client_window_seconds);
  v_global_reset := v_global_window_start + make_interval(secs => p_global_window_seconds);

  insert into plant_id.rate_limit_buckets (scope, bucket_key, window_start, window_seconds, count)
  values ('client', p_client_key, v_client_window_start, p_client_window_seconds, 1)
  on conflict (scope, bucket_key, window_start, window_seconds)
  do update set count = plant_id.rate_limit_buckets.count + 1, updated_at = now()
  returning count into v_client_count;

  if v_client_count > p_client_limit then
    return query select false, p_client_limit, 0, v_client_reset;
    return;
  end if;

  insert into plant_id.rate_limit_buckets (scope, bucket_key, window_start, window_seconds, count)
  values ('global', 'all', v_global_window_start, p_global_window_seconds, 1)
  on conflict (scope, bucket_key, window_start, window_seconds)
  do update set count = plant_id.rate_limit_buckets.count + 1, updated_at = now()
  returning count into v_global_count;

  delete from plant_id.rate_limit_buckets
  where window_start < v_now - make_interval(secs => greatest(p_client_window_seconds, p_global_window_seconds) * 3);

  if v_global_count > p_global_limit then
    return query select false, p_global_limit, 0, v_global_reset;
    return;
  end if;

  return query select true, p_client_limit,
    greatest(0, least(p_client_limit - v_client_count, p_global_limit - v_global_count)),
    least(v_client_reset, v_global_reset);
end;
$$;
