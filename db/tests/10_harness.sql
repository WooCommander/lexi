-- Мини-фреймворк проверок. Все проверки выполняются в одной транзакции (см. 30_rls.sql),
-- чтобы `set local role` действовал до конца тестов.

create schema test;
grant usage on schema test to anon, authenticated;

create table test.ids (
  name  text primary key,
  id    uuid not null default gen_random_uuid()
);

create table test.results (
  n       serial primary key,
  name    text not null,
  passed  boolean not null,
  detail  text
);

create function test.id(p_name text) returns uuid language sql stable as $$
  select id from test.ids where name = p_name
$$;

-- Записывает результат от имени владельца: пользователь с урезанными правами писать в test.results не может.
create function test.record(p_name text, p_passed boolean, p_detail text default null)
returns void language sql security definer as $$
  insert into test.results (name, passed, detail) values (p_name, coalesce(p_passed, false), p_detail)
$$;

grant execute on function test.id(text), test.record(text, boolean, text) to anon, authenticated;
grant select on test.ids to anon, authenticated;

-- Войти как пользователь (роль authenticated, auth.uid() = id по имени из test.ids).
create function test.login(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', test.id(p_name)::text, true);
  set local role authenticated;
end $$;

create function test.anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
end $$;

create function test.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

grant execute on function test.login(text), test.anon(), test.logout() to anon, authenticated;

-- Сколько строк вернёт запрос (с учётом RLS текущей роли).
create function test.rows(p_name text, p_query text, p_expected bigint) returns void language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) q', p_query) into n;
  perform test.record(p_name, n = p_expected, format('rows: expected %s, got %s', p_expected, n));
end $$;

-- Команда должна завершиться ошибкой (нарушение RLS, отсутствие прав, исключение в функции).
create function test.throws(p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  perform test.record(p_name, false, 'expected an error, statement succeeded');
exception when others then
  perform test.record(p_name, true);
end $$;

-- Команда должна пройти без ошибки и затронуть ровно p_expected строк
-- (UPDATE/DELETE под RLS не падают, а молча пропускают чужие строки).
create function test.affects(p_name text, p_sql text, p_expected bigint) returns void language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  perform test.record(p_name, n = p_expected, format('affected: expected %s, got %s', p_expected, n));
exception when others then
  perform test.record(p_name, false, 'unexpected error: ' || sqlerrm);
end $$;

create function test.ok(p_name text, p_cond boolean) returns void language sql as $$
  select test.record(p_name, p_cond)
$$;

grant execute on function
  test.rows(text, text, bigint), test.throws(text, text), test.affects(text, text, bigint), test.ok(text, boolean)
to anon, authenticated;
