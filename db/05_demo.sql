-- =====================================================================
--  LEXI — демо-данные (только для разработки!)
--  Запускать после 01–04. Скрипт пересоздаёт демо-аккаунты с нуля.
--
--  Пароль у всех: demo1234
--    demo.teacher@example.com  — учитель «Анна Петровна» (группа 6А, наборы, задания)
--    demo.student@example.com  — ученик «Алексей» (есть прогресс и сложные слова)
--    demo.parent@example.com   — родитель «Мама Алексея»
-- =====================================================================

-- pgcrypto в Supabase лежит в схеме extensions, в чистом Postgres — в public
set search_path = public, extensions;

do $$
declare
  v_teacher uuid := 'd0000000-0000-4000-8000-000000000001';
  v_student uuid := 'd0000000-0000-4000-8000-000000000002';
  v_parent  uuid := 'd0000000-0000-4000-8000-000000000003';
  v_en uuid := (select id from languages where code = 'en');
  v_ru uuid := (select id from languages where code = 'ru');
  v_ro uuid := (select id from languages where code = 'ro');
  v_set_en uuid := gen_random_uuid();
  v_set_ro uuid := gen_random_uuid();
  v_group uuid := gen_random_uuid();
  v_as_en uuid := gen_random_uuid();
  v_as_ro uuid := gen_random_uuid();
  u record;
  w record;
  v_item uuid;
  i int;
begin
  if v_en is null or v_ru is null or v_ro is null then
    raise exception 'Сначала выполните 04_seed.sql (языки en/ru/ro)';
  end if;

  -- пересоздаём демо-пользователей (каскадом удалятся профили и все их данные)
  delete from auth.users where id in (v_teacher, v_student, v_parent);

  for u in
    select * from (values
      (v_teacher, 'demo.teacher@example.com', '{"name":"Анна Петровна","roles":["teacher"]}'::jsonb),
      (v_student, 'demo.student@example.com', '{"name":"Алексей","roles":["student"]}'::jsonb),
      (v_parent,  'demo.parent@example.com',  '{"name":"Мама Алексея","roles":["parent"]}'::jsonb)
    ) as t(id, email, meta)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      crypt('demo1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, u.meta, now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
  -- профили, роли и настройки создал триггер handle_new_user

  -- ---------- Наборы учителя ----------
  insert into word_sets (id, name, description, source_language_id, target_language_id, owner_id, source)
  values (v_set_en, 'English — Unit 1', 'Первые слова: дом, школа, семья', v_en, v_ru, v_teacher, 'teacher'),
         (v_set_ro, 'Română — Lecția 1', 'Familia și școala', v_ro, v_ru, v_teacher, 'teacher');

  i := 0;
  for w in
    select * from (values
      ('apple', 'яблоко', '/ˈæp.əl/', 'I eat an apple.', 'Я ем яблоко.'),
      ('dog', 'собака', '/dɒɡ/', null, null),
      ('cat', 'кошка', '/kæt/', null, null),
      ('house', 'дом', '/haʊs/', null, null),
      ('school', 'школа', '/skuːl/', 'I go to school.', 'Я хожу в школу.'),
      ('book', 'книга', '/bʊk/', null, null),
      ('friend', 'друг', '/frend/', null, null),
      ('family', 'семья', '/ˈfæm.əl.i/', null, null),
      ('beautiful', 'красивый', '/ˈbjuː.tɪ.fəl/', 'It is a beautiful day.', 'Сегодня прекрасный день.'),
      ('because', 'потому что', '/bɪˈkɒz/', null, null),
      ('through', 'через', '/θruː/', null, null),
      ('thought', 'мысль', '/θɔːt/', null, null),
      ('teacher', 'учитель', '/ˈtiː.tʃər/', null, null),
      ('window', 'окно', '/ˈwɪn.dəʊ/', null, null),
      ('water', 'вода', '/ˈwɔː.tər/', null, null)
    ) as t(src, tgt, tr, ex_s, ex_t)
  loop
    insert into vocabulary_items (source_language_id, target_language_id, source_text, target_text,
                                  source_transcription, example_source, example_target, created_by)
    values (v_en, v_ru, w.src, w.tgt, w.tr, w.ex_s, w.ex_t, v_teacher)
    returning id into v_item;
    insert into word_set_items (word_set_id, vocabulary_item_id, position) values (v_set_en, v_item, i);
    i := i + 1;
  end loop;

  i := 0;
  for w in
    select * from (values
      ('măr', 'яблоко'), ('câine', 'собака'), ('pisică', 'кошка'), ('casă', 'дом'),
      ('școală', 'школа'), ('carte', 'книга'), ('prieten', 'друг'), ('familie', 'семья'),
      ('mulțumesc', 'спасибо'), ('învățător', 'учитель')
    ) as t(src, tgt)
  loop
    insert into vocabulary_items (source_language_id, target_language_id, source_text, target_text, created_by)
    values (v_ro, v_ru, w.src, w.tgt, v_teacher)
    returning id into v_item;
    insert into word_set_items (word_set_id, vocabulary_item_id, position) values (v_set_ro, v_item, i);
    i := i + 1;
  end loop;

  -- ---------- Группа, связи, коды ----------
  insert into groups (id, teacher_id, name, language_id) values (v_group, v_teacher, '6А — English', v_en);
  delete from invite_codes where code in ('ENG-DEMO', 'FAM-DEMO');
  insert into invite_codes (code, owner_id, kind, group_id) values ('ENG-DEMO', v_teacher, 'teacher', v_group);
  insert into invite_codes (code, owner_id, kind) values ('FAM-DEMO', v_parent, 'parent');

  insert into teacher_students (teacher_id, student_id) values (v_teacher, v_student);
  insert into group_students (group_id, student_id) values (v_group, v_student);
  insert into parent_students (parent_id, student_id) values (v_parent, v_student);

  -- ---------- Задания ----------
  -- английский: группе, по 10 новых слов в день, начато 3 дня назад
  insert into assignments (id, assigned_by, word_set_id, group_id, source, start_at, due_at, new_words_per_day, status)
  values (v_as_en, v_teacher, v_set_en, v_group, 'teacher', current_date - 3, current_date + 14, 10, 'active');
  -- румынский: лично ученику, все слова сразу
  insert into assignments (id, assigned_by, word_set_id, source, start_at, due_at, status)
  values (v_as_ro, v_teacher, v_set_ro, 'teacher', current_date, current_date + 21, 'active');
  insert into assignment_students (assignment_id, student_id) values (v_as_en, v_student), (v_as_ro, v_student);

  -- ---------- Прогресс ученика (чтобы статистика не была пустой) ----------
  for w in
    select vi.id, vi.source_text, wsi.position
    from word_set_items wsi join vocabulary_items vi on vi.id = wsi.vocabulary_item_id
    where wsi.word_set_id = v_set_en and wsi.position < 9
  loop
    insert into word_progress (student_id, vocabulary_item_id, status,
      correct_answers, wrong_answers, forward_correct, forward_wrong, reverse_correct, reverse_wrong,
      last_reviewed_at, next_review_at, interval_days)
    select v_student, w.id,
      case when w.position < 4 then 'learned' else 'learning' end,
      p.fc + p.rc, p.fw + p.rw, p.fc, p.fw, p.rc, p.rw,
      now() - interval '1 day',
      -- часть слов уже пора повторять
      case when w.position % 2 = 0 then now() - interval '2 hours' else now() + interval '2 days' end,
      case when w.position < 4 then 7 else 1 end
    from (select
            case when w.position < 4 then 3 else 1 end as fc,
            case when w.position >= 6 then 2 else 0 end as fw,
            case when w.position < 4 then 2 else 1 end as rc,
            case when w.position >= 6 then 2 else 0 end as rw) p;
  end loop;

  -- «through» и «thought» — сложные слова
  update word_progress wp set wrong_answers = 5, forward_wrong = 2, reverse_wrong = 3, correct_answers = 2,
         forward_correct = 1, reverse_correct = 1, status = 'learning', interval_days = 0,
         next_review_at = now() - interval '1 hour', last_reviewed_at = now() - interval '1 day'
  from vocabulary_items vi
  where vi.id = wp.vocabulary_item_id and wp.student_id = v_student and vi.source_text in ('through', 'thought');
  insert into word_progress (student_id, vocabulary_item_id, status, correct_answers, wrong_answers,
    forward_correct, forward_wrong, reverse_correct, reverse_wrong, last_reviewed_at, next_review_at, interval_days)
  select v_student, vi.id, 'learning', 2, 5, 1, 2, 1, 3, now() - interval '1 day', now() - interval '1 hour', 0
  from vocabulary_items vi
  where vi.created_by = v_teacher and vi.source_text in ('through', 'thought')
  on conflict (student_id, vocabulary_item_id) do nothing;

  -- история ответов за последние 6 дней
  insert into review_history (student_id, vocabulary_item_id, direction, result, assignment_id, created_at)
  select v_student, wp.vocabulary_item_id,
         case when g % 2 = 0 then 'forward' else 'reverse' end,
         case when g <= wp.wrong_answers then 'wrong' else 'correct' end,
         v_as_en,
         now() - make_interval(days => (g % 6), hours => g)
  from word_progress wp
  cross join generate_series(1, 6) g
  where wp.student_id = v_student and g <= wp.correct_answers + wp.wrong_answers;

  -- дневная цель ребёнка
  update user_settings set daily_goal = 10 where user_id = v_student;
end $$;
