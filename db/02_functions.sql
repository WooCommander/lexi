-- =====================================================================
--  LEXI — функции и триггеры
--  Хелперы доступа объявлены security definer, чтобы политики RLS
--  не уходили в рекурсию, когда таблицы ссылаются друг на друга.
-- =====================================================================

-- ---------- Регистрация пользователя ---------------------------------
-- Клиент передаёт в options.data: { name: string, roles: ['student' | 'parent' | 'teacher'] }

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r        text;
  roles    jsonb := new.raw_user_meta_data -> 'roles';
  assigned int := 0;
begin
  insert into profiles (id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), nullif(split_part(new.email, '@', 1), ''), 'user'))
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
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = p_role);
$$;

create or replace function is_teacher_of(p_student uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from teacher_students
                 where teacher_id = auth.uid() and student_id = p_student);
$$;

create or replace function is_parent_of(p_student uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from parent_students
                 where parent_id = auth.uid() and student_id = p_student);
$$;

-- Я сам, мой ученик или мой ребёнок.
create or replace function can_view_student(p_student uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select p_student = auth.uid() or is_teacher_of(p_student) or is_parent_of(p_student);
$$;

-- Любая установленная связь в обе стороны (для чтения имён в профилях).
create or replace function is_linked_with(p_user uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select can_view_student(p_user)
      or exists (select 1 from teacher_students where student_id = auth.uid() and teacher_id = p_user)
      or exists (select 1 from parent_students  where student_id = auth.uid() and parent_id  = p_user);
$$;

create or replace function can_read_word_set(p_set uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from word_sets s
                 where s.id = p_set
                   and (s.owner_id = auth.uid() or is_teacher_of(s.owner_id) or is_parent_of(s.owner_id)))
      or exists (select 1 from assignments a
                 join assignment_students ast on ast.assignment_id = a.id
                 where a.word_set_id = p_set and can_view_student(ast.student_id));
$$;

create or replace function can_edit_word_set(p_set uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from word_sets where id = p_set and owner_id = auth.uid());
$$;

create or replace function can_read_vocab_item(p_item uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from vocabulary_items where id = p_item and created_by = auth.uid())
      or exists (select 1 from word_set_items wsi
                 where wsi.vocabulary_item_id = p_item and can_read_word_set(wsi.word_set_id))
      or exists (select 1 from word_progress wp
                 where wp.vocabulary_item_id = p_item and can_view_student(wp.student_id));
$$;

create or replace function can_read_assignment(p_assignment uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from assignments where id = p_assignment and assigned_by = auth.uid())
      or exists (select 1 from assignment_students
                 where assignment_id = p_assignment and can_view_student(student_id));
$$;

create or replace function owns_assignment(p_assignment uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from assignments where id = p_assignment and assigned_by = auth.uid());
$$;

create or replace function owns_group(p_group uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from groups where id = p_group and teacher_id = auth.uid());
$$;

-- ---------- Коды приглашения -----------------------------------------

-- Что увидит ученик перед подтверждением подключения.
create or replace function preview_invite_code(p_code text)
returns table (kind text, owner_name text, group_name text)
language sql security definer stable set search_path = public, pg_temp as $$
  select ic.kind, p.name, g.name
  from invite_codes ic
  join profiles p on p.id = ic.owner_id
  left join groups g on g.id = ic.group_id
  where upper(ic.code) = upper(trim(p_code));
$$;

create or replace function redeem_invite_code(p_code text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
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
    -- Уже «управляемому» ребёнку нельзя подключить ещё одного родителя своим кодом: иначе он обошёл бы контроль настоящего.
    if is_managed_by_parent(me)
       and not exists (select 1 from parent_students where parent_id = v.owner_id and student_id = me) then
      raise exception 'already_managed' using errcode = '42501';
    end if;
    insert into parent_students (parent_id, student_id) values (v.owner_id, me) on conflict do nothing;
  else
    insert into teacher_students (teacher_id, student_id) values (v.owner_id, me) on conflict do nothing;

    if v.group_id is not null then
      insert into group_students (group_id, student_id) values (v.group_id, me) on conflict do nothing;
      -- новый участник группы получает уже активные задания группы
      insert into assignment_students (assignment_id, student_id)
        select a.id, me from assignments a
        where a.group_id = v.group_id and a.status = 'active' and a.assigned_by = v.owner_id
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
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function require_admin()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- Только владелец БД / SQL Editor: выдать роль администратора по почте.
create or replace function grant_admin(p_email text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  select id into v_id from auth.users
   where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null;
  if v_id is null then
    raise exception 'user_not_found_or_unconfirmed';
  end if;
  insert into profiles (id, name) values (v_id, split_part(trim(p_email), '@', 1)) on conflict (id) do nothing;
  insert into user_roles (user_id, role) values (v_id, 'admin') on conflict do nothing;
end $$;

-- Последнего администратора из приложения не снять: иначе управление потеряно.
-- Из SQL Editor (auth.uid() is null) ограничение не действует.
create or replace function guard_last_admin()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null
     and old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.user_id <> old.user_id)
  then
    perform pg_advisory_xact_lock(7101);  -- два админа одновременно не обойдут проверку
    if (select count(*) from user_roles where role = 'admin') <= 1 then
      raise exception 'last_admin' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists user_roles_guard_last_admin on user_roles;
create trigger user_roles_guard_last_admin
  before delete or update of role, user_id on user_roles
  for each row execute function guard_last_admin();

-- Коды приглашений хранятся в верхнем регистре без пробелов.
create or replace function normalize_invite_code()
returns trigger language plpgsql as $$
begin
  new.code := upper(regexp_replace(new.code, '\s+', '', 'g'));
  return new;
end $$;

drop trigger if exists invite_codes_normalize on invite_codes;
create trigger invite_codes_normalize
  before insert or update of code on invite_codes
  for each row execute function normalize_invite_code();

-- Сводка по всем пользователям.
create or replace function admin_overview()
returns json language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform require_admin();
  if p_user = auth.uid() then
    raise exception 'cannot_delete_self' using errcode = '42501';
  end if;
  delete from auth.users where id = p_user;
end $$;

-- Активность по дням: сколько пользователей занималось и сколько ответов дали.
create or replace function admin_activity(p_days int default 30)
returns table (day date, active_users bigint, answers bigint, correct bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := greatest(1, least(coalesce(p_days, 30), 365));
begin
  perform require_admin();
  return query
    select d::date,
           coalesce(count(distinct h.student_id), 0),
           coalesce(count(h.id), 0),
           coalesce(count(h.id) filter (where h.result = 'correct'), 0)
    from generate_series(current_date - (n - 1), current_date, interval '1 day') d
    left join review_history h on h.created_at >= d and h.created_at < d + interval '1 day'
    group by d
    order by d;
end $$;

-- Новые пользователи по дням и ролям.
create or replace function admin_signups(p_days int default 30)
returns table (day date, students bigint, teachers bigint, parents bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := greatest(1, least(coalesce(p_days, 30), 365));
begin
  perform require_admin();
  return query
    select d::date,
           coalesce(count(*) filter (where r.role = 'student'), 0),
           coalesce(count(*) filter (where r.role = 'teacher'), 0),
           coalesce(count(*) filter (where r.role = 'parent'), 0)
    from generate_series(current_date - (n - 1), current_date, interval '1 day') d
    left join profiles p on p.created_at >= d and p.created_at < d + interval '1 day'
    left join user_roles r on r.user_id = p.id
    group by d
    order by d;
end $$;

-- Сколько учеников освоили 0 / 1–9 / 10–49 / 50–99 / 100+ слов.
create or replace function admin_learned_distribution()
returns table (bucket text, ord int, students bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform require_admin();
  return query
    with per_student as (
      select r.user_id,
             (select count(*) from word_progress wp where wp.student_id = r.user_id and wp.status = 'learned') as learned
      from user_roles r where r.role = 'student'
    )
    select b.label, b.ord, coalesce(count(ps.user_id), 0)
    from (values ('0', 1, 0, 0), ('1–9', 2, 1, 9), ('10–49', 3, 10, 49), ('50–99', 4, 50, 99), ('100+', 5, 100, 2147483647))
         as b(label, ord, lo, hi)
    left join per_student ps on ps.learned between b.lo and b.hi
    group by b.label, b.ord
    order by b.ord;
end $$;

-- Языки: сколько учеников учит, сколько слов освоено, ответов за 30 дней.
-- Изучаемый язык пары — тот, что не родной для ученика (родной из user_settings, по умолчанию русский).
create or replace function admin_language_stats()
returns table (language_id uuid, code text, name text, learners bigint, learned bigint, answers_30d bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform require_admin();
  return query
    with ru as (select l.id from languages l where l.code = 'ru'),
    studied as (
      select wp.student_id, wp.status,
             case when vi.source_language_id = coalesce(us.native_language_id, (select id from ru))
                  then vi.target_language_id else vi.source_language_id end as lang
      from word_progress wp
      join vocabulary_items vi on vi.id = wp.vocabulary_item_id
      left join user_settings us on us.user_id = wp.student_id
    ),
    per_language as (
      select lang, count(distinct student_id) as learners, count(*) filter (where status = 'learned') as learned
      from studied group by lang
    ),
    recent as (
      select case when hv.source_language_id = coalesce(us.native_language_id, (select id from ru))
                  then hv.target_language_id else hv.source_language_id end as lang,
             count(*) as answers
      from review_history h
      join vocabulary_items hv on hv.id = h.vocabulary_item_id
      left join user_settings us on us.user_id = h.student_id
      where h.created_at >= now() - interval '30 days'
      group by 1
    )
    select l.id, l.code, coalesce(l.display_name, l.native_name, l.name),
           pl.learners, pl.learned, coalesce(r.answers, 0)
    from per_language pl
    join languages l on l.id = pl.lang
    left join recent r on r.lang = pl.lang
    order by pl.learned desc, pl.learners desc;
end $$;

-- Самые «популярные» слова: по числу ответов всех пользователей.
create or replace function admin_popular_words(p_limit int default 20)
returns table (item_id uuid, source_text text, target_text text, language_code text, learners bigint, answers bigint, correct bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform require_admin();
  return query
    select vi.id, vi.source_text, vi.target_text, sl.code,
           count(distinct wp.student_id),
           coalesce(sum(wp.correct_answers + wp.wrong_answers), 0)::bigint,
           coalesce(sum(wp.correct_answers), 0)::bigint
    from word_progress wp
    join vocabulary_items vi on vi.id = wp.vocabulary_item_id
    join languages sl on sl.id = vi.source_language_id
    group by vi.id, vi.source_text, vi.target_text, sl.code
    order by 6 desc, 5 desc, vi.source_text
    limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;

-- Учителя: ученики, группы, наборы, задания и успехи их учеников.
create or replace function admin_teachers()
returns table (teacher_id uuid, name text, students bigint, groups bigint, sets bigint, assignments bigint,
               learned bigint, correct bigint, wrong bigint, active_students_7d bigint, last_active timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform require_admin();
  return query
    select p.id, p.name,
           (select count(*) from teacher_students ts where ts.teacher_id = p.id),
           (select count(*) from groups g where g.teacher_id = p.id),
           (select count(*) from word_sets s where s.owner_id = p.id and s.source = 'teacher'),
           (select count(*) from assignments a where a.assigned_by = p.id and a.source = 'teacher'),
           (select count(*) from word_progress wp join teacher_students ts on ts.student_id = wp.student_id
              where ts.teacher_id = p.id and wp.status = 'learned'),
           (select coalesce(sum(wp.correct_answers), 0) from word_progress wp join teacher_students ts on ts.student_id = wp.student_id
              where ts.teacher_id = p.id)::bigint,
           (select coalesce(sum(wp.wrong_answers), 0) from word_progress wp join teacher_students ts on ts.student_id = wp.student_id
              where ts.teacher_id = p.id)::bigint,
           (select count(distinct h.student_id) from review_history h join teacher_students ts on ts.student_id = h.student_id
              where ts.teacher_id = p.id and h.created_at >= now() - interval '7 days'),
           (select max(h.created_at) from review_history h join teacher_students ts on ts.student_id = h.student_id
              where ts.teacher_id = p.id)
    from profiles p
    where exists (select 1 from user_roles r where r.user_id = p.id and r.role = 'teacher')
    order by 7 desc, 3 desc, p.name;
end $$;

revoke execute on function grant_admin(text) from public, anon, authenticated;
revoke execute on function require_admin(), admin_overview(), admin_top_learners(int),
  admin_list_users(), admin_delete_user(uuid), admin_activity(int), admin_signups(int),
  admin_learned_distribution(), admin_language_stats(), admin_popular_words(int), admin_teachers()
  from public, anon;
grant execute on function admin_overview(), admin_top_learners(int), admin_list_users(), admin_delete_user(uuid),
  admin_activity(int), admin_signups(int), admin_learned_distribution(), admin_language_stats(),
  admin_popular_words(int), admin_teachers()
  to authenticated;

-- Можно ли пользователю создавать личные наборы и слова (запрет ставит родитель; по умолчанию — можно).
create or replace function personal_words_allowed(p_user uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select coalesce((select allow_personal_words from user_settings where user_id = p_user), true);
$$;

-- ---------- Профиль: что ребёнок меняет сам, а что — только родитель -------------
-- Пока у пользователя есть родитель, он «управляемый». Сам он может: имя, число слов в тренировке,
-- тему/озвучку (на устройстве). Дневная цель, цели по языкам, родной язык, доступные языки,
-- личные слова и роли — только родитель. Пользователи без родителя свободны.
-- RLS разрешает строку user_settings целиком, поэтому защищаем триггером; service_role и
-- SQL Editor (auth.uid() is null) не затрагиваются.
create or replace function is_managed_by_parent(p_user uuid)
returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from parent_students where student_id = p_user);
$$;

create or replace function guard_parent_restrictions()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
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
