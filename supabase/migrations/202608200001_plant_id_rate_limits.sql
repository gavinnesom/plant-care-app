create schema if not exists plant_id;

create table if not exists plant_id.rate_limit_buckets (
  scope text not null,
  bucket_key text not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, bucket_key, window_start, window_seconds),
  constraint plant_id_rate_limit_scope_check check (scope in ('client', 'global')),
  constraint plant_id_rate_limit_window_check check (window_seconds > 0),
  constraint plant_id_rate_limit_count_check check (count >= 0)
);

create index if not exists plant_id_rate_limit_buckets_cleanup_idx
  on plant_id.rate_limit_buckets (window_start);

create or replace function plant_id.check_rate_limit(
  p_client_key text,
  p_client_limit integer,
  p_client_window_seconds integer,
  p_global_limit integer,
  p_global_window_seconds integer
)
returns table (
  success boolean,
  limit_value integer,
  remaining integer,
  reset_at timestamptz
)
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
  if p_client_key is null or p_client_key = '' then
    raise exception 'client key is required';
  end if;
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
  do update set
    count = plant_id.rate_limit_buckets.count + 1,
    updated_at = now()
  returning count into v_client_count;

  insert into plant_id.rate_limit_buckets (scope, bucket_key, window_start, window_seconds, count)
  values ('global', 'all', v_global_window_start, p_global_window_seconds, 1)
  on conflict (scope, bucket_key, window_start, window_seconds)
  do update set
    count = plant_id.rate_limit_buckets.count + 1,
    updated_at = now()
  returning count into v_global_count;

  delete from plant_id.rate_limit_buckets
  where window_start < v_now - make_interval(secs => greatest(p_client_window_seconds, p_global_window_seconds) * 3);

  if v_client_count > p_client_limit then
    return query select false, p_client_limit, 0, v_client_reset;
    return;
  end if;

  if v_global_count > p_global_limit then
    return query select false, p_global_limit, 0, v_global_reset;
    return;
  end if;

  return query select
    true,
    p_client_limit,
    greatest(0, least(p_client_limit - v_client_count, p_global_limit - v_global_count)),
    least(v_client_reset, v_global_reset);
end;
$$;

revoke all on schema plant_id from public;
revoke all on all tables in schema plant_id from public, anon, authenticated;
revoke all on all functions in schema plant_id from public, anon, authenticated;
