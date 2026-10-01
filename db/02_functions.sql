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
  r     text;
  roles jsonb := new.raw_user_meta_data -> 'roles';
begin
  insert into profiles (id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  if roles is null or jsonb_typeof(roles) <> 'array' or jsonb_array_length(roles) = 0 then
    roles := '["student"]'::jsonb;
  end if;

  for r in select jsonb_array_elements_text(roles) loop
    if r in ('student', 'parent', 'teacher') then
      insert into user_roles (user_id, role) values (new.id, r) on conflict do nothing;
    end if;
  end loop;

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
