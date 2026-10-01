-- =====================================================================
--  LEXI — схема базы данных (Supabase / PostgreSQL)
--  Порядок запуска в Supabase SQL Editor:
--    01_schema.sql → 02_functions.sql → 03_rls.sql → 04_seed.sql
--
--  Главный принцип: ядро не знает, какой язык изучается.
--  Нет полей english/russian — только языковые пары source → target.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Пользователи ---------------------------------------------

create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default '',
  created_at  timestamptz not null default now()
);

-- Один пользователь может иметь несколько ролей.
create table if not exists user_roles (
  user_id  uuid not null references profiles on delete cascade,
  role     text not null check (role in ('student', 'parent', 'teacher')),
  primary key (user_id, role)
);

-- ---------- Языки ----------------------------------------------------

create table if not exists languages (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- en, ru, ro, uk ...
  name          text not null,                 -- English
  native_name   text,                          -- Română
  display_name  text,                          -- настраиваемое: «Молдавский / румынский»
  flag          text,                          -- эмодзи-флаг
  created_by    uuid references profiles on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);

-- ---------- Связи родитель / учитель ↔ ученик ------------------------

create table if not exists parent_students (
  parent_id   uuid not null references profiles on delete cascade,
  student_id  uuid not null references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (parent_id, student_id),
  check (parent_id <> student_id)
);

create table if not exists teacher_students (
  teacher_id  uuid not null references profiles on delete cascade,
  student_id  uuid not null references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (teacher_id, student_id),
  check (teacher_id <> student_id)
);

-- ---------- Группы ---------------------------------------------------

create table if not exists groups (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references profiles on delete cascade default auth.uid(),
  name         text not null,                  -- «6А — English»
  language_id  uuid references languages on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists group_students (
  group_id    uuid not null references groups on delete cascade,
  student_id  uuid not null references profiles on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (group_id, student_id)
);

-- Коды приглашения: учителя (опционально в группу) или родителя.
create table if not exists invite_codes (
  code        text primary key,                -- ENG-7K4P
  owner_id    uuid not null references profiles on delete cascade default auth.uid(),
  kind        text not null check (kind in ('teacher', 'parent')),
  group_id    uuid references groups on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------- Слова и наборы -------------------------------------------

create table if not exists vocabulary_items (
  id                    uuid primary key default gen_random_uuid(),
  source_language_id    uuid not null references languages,
  target_language_id    uuid not null references languages,
  source_text           text not null,
  target_text           text not null,
  source_transcription  text,
  target_transcription  text,
  example_source        text,
  example_target        text,
  created_by            uuid not null references profiles on delete cascade default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (source_language_id <> target_language_id)
);

create table if not exists word_sets (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  source_language_id  uuid not null references languages,
  target_language_id  uuid not null references languages,
  owner_id            uuid not null references profiles on delete cascade default auth.uid(),
  source              text not null default 'personal'
                        check (source in ('personal', 'parent', 'teacher')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (source_language_id <> target_language_id)
);

-- many-to-many: одно слово может входить в несколько наборов
create table if not exists word_set_items (
  word_set_id         uuid not null references word_sets on delete cascade,
  vocabulary_item_id  uuid not null references vocabulary_items on delete cascade,
  position            int  not null default 0,
  added_at            timestamptz not null default now(),
  primary key (word_set_id, vocabulary_item_id)
);

-- ---------- Задания --------------------------------------------------

create table if not exists assignments (
  id                 uuid primary key default gen_random_uuid(),
  assigned_by        uuid not null references profiles on delete cascade default auth.uid(), -- teacherId из ТЗ (или родитель)
  word_set_id        uuid not null references word_sets on delete cascade,
  group_id           uuid references groups on delete set null,  -- если назначено группе
  source             text not null default 'teacher' check (source in ('teacher', 'parent')),
  start_at           date,
  due_at             date,
  new_words_per_day  int check (new_words_per_day is null or new_words_per_day > 0),
  status             text not null default 'active'
                       check (status in ('draft', 'active', 'completed', 'archived')),
  created_at         timestamptz not null default now()
);

create table if not exists assignment_students (
  assignment_id  uuid not null references assignments on delete cascade,
  student_id     uuid not null references profiles on delete cascade,
  primary key (assignment_id, student_id)
);

-- ---------- Прогресс и история ---------------------------------------

-- Статус относится не к слову, а к конкретному ученику.
create table if not exists word_progress (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references profiles on delete cascade default auth.uid(),
  vocabulary_item_id  uuid not null references vocabulary_items on delete cascade,
  status              text not null default 'new' check (status in ('new', 'learning', 'learned')),
  correct_answers     int  not null default 0,
  wrong_answers       int  not null default 0,
  forward_correct     int  not null default 0,   -- source → target
  forward_wrong       int  not null default 0,
  reverse_correct     int  not null default 0,   -- target → source
  reverse_wrong       int  not null default 0,
  last_reviewed_at    timestamptz,
  next_review_at      timestamptz,
  interval_days       int  not null default 0,
  created_at          timestamptz not null default now(),
  unique (student_id, vocabulary_item_id)
);

-- Каждый ответ пользователя.
create table if not exists review_history (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references profiles on delete cascade default auth.uid(),
  vocabulary_item_id  uuid not null references vocabulary_items on delete cascade,
  direction           text not null check (direction in ('forward', 'reverse')),
  result              text not null check (result in ('correct', 'wrong', 'unsure')),
  assignment_id       uuid references assignments on delete set null,
  created_at          timestamptz not null default now()
);

create table if not exists favorites (
  student_id          uuid not null references profiles on delete cascade default auth.uid(),
  vocabulary_item_id  uuid not null references vocabulary_items on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (student_id, vocabulary_item_id)
);

-- ---------- Настройки ------------------------------------------------

create table if not exists user_settings (
  user_id               uuid primary key references profiles on delete cascade,
  daily_goal            int  not null default 10 check (daily_goal > 0),
  language_goals        jsonb not null default '{}'::jsonb,   -- { "<language_id>": 15 }
  session_size          int  not null default 10 check (session_size > 0),
  native_language_id    uuid references languages on delete set null,
  allowed_language_ids  uuid[],                               -- null = все языки
  allow_personal_words  boolean not null default true,
  updated_at            timestamptz not null default now()
);

-- ---------- Индексы --------------------------------------------------

create index if not exists idx_teacher_students_student on teacher_students(student_id);
create index if not exists idx_parent_students_student  on parent_students(student_id);
create index if not exists idx_groups_teacher           on groups(teacher_id);
create index if not exists idx_group_students_student   on group_students(student_id);
create index if not exists idx_invite_codes_owner       on invite_codes(owner_id);
create index if not exists idx_vocab_created_by         on vocabulary_items(created_by);
create index if not exists idx_word_sets_owner          on word_sets(owner_id);
create index if not exists idx_wsi_item                 on word_set_items(vocabulary_item_id);
create index if not exists idx_assignments_by           on assignments(assigned_by);
create index if not exists idx_assignments_set          on assignments(word_set_id);
create index if not exists idx_assignments_group        on assignments(group_id);
create index if not exists idx_assignment_students_st   on assignment_students(student_id);
create index if not exists idx_progress_student_next    on word_progress(student_id, next_review_at);
create index if not exists idx_progress_item            on word_progress(vocabulary_item_id);
create index if not exists idx_history_student_created  on review_history(student_id, created_at desc);
create index if not exists idx_history_item             on review_history(vocabulary_item_id);
