-- Проверка после db/05_demo.sql: демо-аккаунты созданы, у админа есть права и дашборд работает.
begin;

do $$
begin
  if (select count(*) from auth.users where email like 'demo.%@example.com') <> 4 then
    raise exception 'demo: ожидалось 4 аккаунта';
  end if;
  if not exists (select 1 from user_roles where user_id = 'd0000000-0000-4000-8000-000000000004' and role = 'admin') then
    raise exception 'demo: у demo.admin нет роли admin';
  end if;
  if (select count(*) from user_roles where user_id in ('d0000000-0000-4000-8000-000000000001',
        'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003') and role = 'admin') > 0 then
    raise exception 'demo: админская роль утекла обычным демо-аккаунтам';
  end if;
end $$;

select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000004', true);
set local role authenticated;

do $$
begin
  if not is_admin() then raise exception 'demo: demo.admin не администратор'; end if;
  if (admin_overview() ->> 'users')::int < 4 then raise exception 'demo: сводка админа пуста'; end if;
  if not exists (select 1 from admin_teachers() where learned >= 0) then raise exception 'demo: нет учителей в сводке'; end if;
  if (select count(*) from word_progress) = 0 then raise exception 'demo: админ не видит прогресс учеников'; end if;
end $$;

reset role;
commit;
