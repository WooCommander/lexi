-- =====================================================================
--  Тестовое окружение: минимальная имитация Supabase поверх чистого Postgres.
--  Не запускать в боевом проекте — Supabase всё это уже содержит.
-- =====================================================================

create role anon          nologin;
create role authenticated nologin;
create role service_role  nologin bypassrls;

create schema if not exists auth;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Как в Supabase: пользователь берётся из claim'ов JWT, которые PostgREST кладёт в настройки сессии.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public, auth to anon, authenticated, service_role;

-- Supabase выдаёт эти права по умолчанию: защита держится на RLS, а не на отсутствии GRANT.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
