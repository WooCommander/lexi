-- =====================================================================
--  LEXI — функции и триггеры
--  Хелперы доступа объявлены security definer, чтобы политики RLS
--  не уходили в рекурсию, когда таблицы ссылаются друг на друга.
-- =====================================================================

-- ---------- Регистрация пользователя ---------------------------------
-- Клиент передаёт в options.data: { name: string, roles: ['student' | 'parent' | 'teacher'] }

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r        text;
  roles    jsonb := new.raw_user_meta_data -> 'roles';
  assigned int := 0;
begin
  insert into profiles (id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  if roles is null or jsonb_typeof(roles) <> 'array' or jsonb_array_length(roles) = 0 then
    roles := '["student"]'::jsonb;
  end if;

  -- 'admin' из метаданных регистрации игнорируется: администратора назначают только вручную (grant_admin).
  for r in select jsonb_array_elements_text(roles) loop
    if r in ('student', 'parent', 'teacher') then
      insert into user_roles (user_id, role) values (new.id, r) on conflict do nothing;
      assigned := assigned + 1;
    end if;
  end loop;
  if assigned = 0 then
    insert into user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  end if;

  insert into user_settings (user_id, native_language_id)
  values (new.id, (select id from languages where code = 'ru'))
  on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Хелперы доступа ------------------------------------------

create or replace function has_role(p_role text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = p_role);
$$;

create or replace function is_teacher_of(p_student uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from teacher_students
                 where teacher_id = auth.uid() and student_id = p_student);
$$;

create or replace function is_parent_of(p_student uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from parent_students
                 where parent_id = auth.uid() and student_id = p_student);
$$;

-- Я сам, мой ученик или мой ребёнок.
create or replace function can_view_student(p_student uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select p_student = auth.uid() or is_teacher_of(p_student) or is_parent_of(p_student);
$$;

-- Любая установленная связь в обе стороны (для чтения имён в профилях).
create or replace function is_linked_with(p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select can_view_student(p_user)
      or exists (select 1 from teacher_students where student_id = auth.uid() and teacher_id = p_user)
      or exists (select 1 from parent_students  where student_id = auth.uid() and parent_id  = p_user);
$$;

create or replace function can_read_word_set(p_set uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from word_sets s
                 where s.id = p_set
                   and (s.owner_id = auth.uid() or is_teacher_of(s.owner_id) or is_parent_of(s.owner_id)))
      or exists (select 1 from assignments a
                 join assignment_students ast on ast.assignment_id = a.id
                 where a.word_set_id = p_set and can_view_student(ast.student_id));
$$;

create or replace function can_edit_word_set(p_set uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from word_sets where id = p_set and owner_id = auth.uid());
$$;

create or replace function can_read_vocab_item(p_item uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from vocabulary_items where id = p_item and created_by = auth.uid())
      or exists (select 1 from word_set_items wsi
                 where wsi.vocabulary_item_id = p_item and can_read_word_set(wsi.word_set_id))
      or exists (select 1 from word_progress wp
                 where wp.vocabulary_item_id = p_item and can_view_student(wp.student_id));
$$;

create or replace function can_read_assignment(p_assignment uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from assignments where id = p_assignment and assigned_by = auth.uid())
      or exists (select 1 from assignment_students
                 where assignment_id = p_assignment and can_view_student(student_id));
$$;

create or replace function owns_assignment(p_assignment uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from assignments where id = p_assignment and assigned_by = auth.uid());
$$;

create or replace function owns_group(p_group uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from groups where id = p_group and teacher_id = auth.uid());
$$;

-- ---------- Коды приглашения -----------------------------------------

-- Что увидит ученик перед подтверждением подключения.
create or replace function preview_invite_code(p_code text)
returns table (kind text, owner_name text, group_name text)
language sql security definer stable set search_path = public as $$
  select ic.kind, p.name, g.name
  from invite_codes ic
  join profiles p on p.id = ic.owner_id
  left join groups g on g.id = ic.group_id
  where upper(ic.code) = upper(trim(p_code));
$$;

create or replace function redeem_invite_code(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v  invite_codes%rowtype;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  select * into v from invite_codes where upper(code) = upper(trim(p_code));
  if not found then
    raise exception 'invalid_code';
  end if;
  if v.owner_id = me then
    raise exception 'own_code';
  end if;

  insert into user_roles (user_id, role) values (me, 'student') on conflict do nothing;

  if v.kind = 'parent' then
    insert into parent_students (parent_id, student_id) values (v.owner_id, me) on conflict do nothing;
  else
    insert into teacher_students (teacher_id, student_id) values (v.owner_id, me) on conflict do nothing;

    if v.group_id is not null then
      insert into group_students (group_id, student_id) values (v.group_id, me) on conflict do nothing;
      -- новый участник группы получает уже активные задания группы
      insert into assignment_students (assignment_id, student_id)
        select a.id, me from assignments a
        where a.group_id = v.group_id and a.status = 'active'
      on conflict do nothing;
    end if;
  end if;

  return json_build_object('kind', v.kind, 'group_id', v.group_id, 'owner_id', v.owner_id);
end $$;

grant execute on function preview_invite_code(text) to authenticated;
grant execute on function redeem_invite_code(text)  to authenticated;

-- Коды подбираются перебором, поэтому ни предпросмотр, ни подключение не доступны без входа.
-- (В Supabase права anon выдаются по умолчанию, отдельно от PUBLIC — отзываем оба.)
revoke execute on function preview_invite_code(text) from public, anon;
revoke execute on function redeem_invite_code(text)  from public, anon;

-- ---------- Администратор -------------------------------------------
-- Роль 'admin' нельзя выдать себе через API (см. политику "roles insert").
-- Первого администратора назначают в SQL Editor:  select grant_admin('почта@пример.ru');

create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function require_admin()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- Только владелец БД / SQL Editor: выдать роль администратора по почте.
create or replace function grant_admin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'user_not_found';
  end if;
  insert into profiles (id, name) values (v_id, split_part(trim(p_email), '@', 1)) on conflict (id) do nothing;
  insert into user_roles (user_id, role) values (v_id, 'admin') on conflict do nothing;
end $$;

-- Последнего администратора из приложения не снять: иначе управление потеряно.
-- Из SQL Editor (auth.uid() is null) ограничение не действует.
create or replace function guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and old.role = 'admin'
     and (select count(*) from user_roles where role = 'admin') <= 1
  then
    raise exception 'last_admin' using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists user_roles_guard_last_admin on user_roles;
create trigger user_roles_guard_last_admin
  before delete on user_roles
  for each row execute function guard_last_admin();

-- Сводка по всем пользователям.
create or replace function admin_overview()
returns json language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  return json_build_object(
    'users',            (select count(*) from profiles),
    'by_role',          (select coalesce(json_object_agg(role, n), '{}'::json)
                         from (select role, count(*) as n from user_roles group by role) r),
    'active_7d',        (select count(distinct student_id) from review_history where created_at >= now() - interval '7 days'),
    'answers_7d',       (select count(*) from review_history where created_at >= now() - interval '7 days'),
    'learned_words',    (select count(*) from word_progress where status = 'learned'),
    'vocabulary_items', (select count(*) from vocabulary_items),
    'word_sets',        (select count(*) from word_sets),
    'assignments',      (select count(*) from assignments),
    'groups',           (select count(*) from groups)
  );
end $$;

-- Рейтинг по числу освоенных слов среди всех пользователей.
create or replace function admin_top_learners(p_limit int default 20)
returns table (student_id uuid, name text, learned bigint, correct bigint, wrong bigint, last_active timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  return query
    select p.id, p.name,
           count(*) filter (where wp.status = 'learned'),
           coalesce(sum(wp.correct_answers), 0)::bigint,
           coalesce(sum(wp.wrong_answers), 0)::bigint,
           max(wp.last_reviewed_at)
    from profiles p
    join word_progress wp on wp.student_id = p.id
    group by p.id, p.name
    order by 3 desc, 4 desc, p.name
    limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;

-- Все пользователи с почтой и последним входом (почта живёт в auth.users, клиенту она недоступна).
create or replace function admin_list_users()
returns table (id uuid, name text, email text, roles text[], created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  return query
    select p.id, p.name, u.email::text,
           coalesce((select array_agg(r.role order by r.role) from user_roles r where r.user_id = p.id), '{}'::text[]),
           p.created_at, u.last_sign_in_at
    from profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;

-- Полное удаление пользователя вместе с его данными. Себя удалить нельзя.
create or replace function admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_user = auth.uid() then
    raise exception 'cannot_delete_self' using errcode = '42501';
  end if;
  delete from auth.users where id = p_user;
end $$;

revoke execute on function grant_admin(text) from public, anon, authenticated;
revoke execute on function require_admin(), admin_overview(), admin_top_learners(int),
  admin_list_users(), admin_delete_user(uuid) from public, anon;
grant execute on function admin_overview(), admin_top_learners(int), admin_list_users(), admin_delete_user(uuid)
  to authenticated;

-- ---------- Профиль: что ребёнок меняет сам, а что — только родитель -------------
-- Пока у пользователя есть родитель, он «управляемый». Сам он может: имя, число слов в тренировке,
-- тему/озвучку (на устройстве). Дневная цель, цели по языкам, родной язык, доступные языки,
-- личные слова и роли — только родитель. Пользователи без родителя свободны.
-- RLS разрешает строку user_settings целиком, поэтому защищаем триггером; service_role и
-- SQL Editor (auth.uid() is null) не затрагиваются.
create or replace function is_managed_by_parent(p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from parent_students where student_id = p_user);
$$;

create or replace function guard_parent_restrictions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and auth.uid() = new.user_id
     and (new.allowed_language_ids is distinct from old.allowed_language_ids
          or new.allow_personal_words is distinct from old.allow_personal_words
          or new.daily_goal is distinct from old.daily_goal
          or new.language_goals is distinct from old.language_goals
          or new.native_language_id is distinct from old.native_language_id)
     and is_managed_by_parent(new.user_id)
     and not is_admin()
  then
    raise exception 'restricted_by_parent' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists user_settings_guard_parent on user_settings;
create trigger user_settings_guard_parent
  before update on user_settings
  for each row execute function guard_parent_restrictions();
