create schema if not exists plant_id;

create table if not exists plant_id.garden_plants (
  id uuid primary key,
  garden_name text not null,
  location text not null default '',
  plant_type text not null default '',
  identity_source text not null default 'manual',
  ai_assessment_state text not null default 'none',
  ai_common_name text not null default '',
  ai_scientific_name text not null default '',
  ai_confidence numeric,
  ai_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint garden_plants_name_check check (length(trim(garden_name)) > 0),
  constraint garden_plants_identity_source_check check (identity_source in ('manual', 'ai_initial')),
  constraint garden_plants_ai_state_check check (ai_assessment_state in ('none', 'ai_guess')),
  constraint garden_plants_ai_confidence_check check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1))
);

create table if not exists plant_id.garden_photos (
  id uuid primary key,
  plant_id uuid not null references plant_id.garden_plants(id) on delete restrict,
  mime_type text not null,
  byte_size integer not null,
  image_bytes bytea not null,
  alt_text text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint garden_photos_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint garden_photos_byte_size_check check (byte_size > 0 and byte_size <= 8388608)
);

create index if not exists garden_plants_active_updated_idx
  on plant_id.garden_plants (updated_at desc)
  where deleted_at is null;

create index if not exists garden_photos_active_plant_idx
  on plant_id.garden_photos (plant_id, is_primary desc, created_at asc)
  where deleted_at is null;

create or replace function plant_id.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists garden_plants_set_updated_at on plant_id.garden_plants;
create trigger garden_plants_set_updated_at
before update on plant_id.garden_plants
for each row
execute function plant_id.set_updated_at();

drop trigger if exists garden_photos_set_updated_at on plant_id.garden_photos;
create trigger garden_photos_set_updated_at
before update on plant_id.garden_photos
for each row
execute function plant_id.set_updated_at();

revoke all on schema plant_id from public;
revoke all on all tables in schema plant_id from public, anon, authenticated;
revoke all on all functions in schema plant_id from public, anon, authenticated;
