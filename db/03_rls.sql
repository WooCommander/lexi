-- =====================================================================
--  LEXI — Row Level Security
--  Ученик: только свои данные + назначенные ему наборы.
--  Родитель: данные связанных детей.
--  Учитель: данные связанных учеников и своих групп.
--  Скрипт можно запускать повторно.
-- =====================================================================

alter table profiles            enable row level security;
alter table user_roles          enable row level security;
alter table languages           enable row level security;
alter table parent_students     enable row level security;
alter table teacher_students    enable row level security;
alter table groups              enable row level security;
alter table group_students      enable row level security;
alter table invite_codes        enable row level security;
alter table vocabulary_items    enable row level security;
alter table word_sets           enable row level security;
alter table word_set_items      enable row level security;
alter table assignments         enable row level security;
alter table assignment_students enable row level security;
alter table word_progress       enable row level security;
alter table review_history      enable row level security;
alter table favorites           enable row level security;
alter table user_settings       enable row level security;

-- ---------- profiles -------------------------------------------------
drop policy if exists "profiles read"   on profiles;
drop policy if exists "profiles update" on profiles;
create policy "profiles read" on profiles for select
  using (id = auth.uid() or is_linked_with(id));
create policy "profiles update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- user_roles -----------------------------------------------
drop policy if exists "roles read"   on user_roles;
drop policy if exists "roles insert" on user_roles;
drop policy if exists "roles delete" on user_roles;
create policy "roles read" on user_roles for select
  using (user_id = auth.uid() or is_linked_with(user_id));
create policy "roles insert" on user_roles for insert
  with check (user_id = auth.uid());
create policy "roles delete" on user_roles for delete
  using (user_id = auth.uid());

-- ---------- languages ------------------------------------------------
drop policy if exists "languages read"   on languages;
drop policy if exists "languages insert" on languages;
drop policy if exists "languages update" on languages;
create policy "languages read" on languages for select using (true);
create policy "languages insert" on languages for insert
  with check (has_role('teacher') or has_role('parent'));
create policy "languages update" on languages for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- ---------- parent_students / teacher_students -----------------------
-- Создаются только через redeem_invite_code(). Разорвать связь может любая сторона.
drop policy if exists "parent links read"   on parent_students;
drop policy if exists "parent links delete" on parent_students;
create policy "parent links read" on parent_students for select
  using (parent_id = auth.uid() or student_id = auth.uid());
create policy "parent links delete" on parent_students for delete
  using (parent_id = auth.uid() or student_id = auth.uid());

drop policy if exists "teacher links read"   on teacher_students;
drop policy if exists "teacher links delete" on teacher_students;
create policy "teacher links read" on teacher_students for select
  using (teacher_id = auth.uid() or student_id = auth.uid() or is_parent_of(student_id));
create policy "teacher links delete" on teacher_students for delete
  using (teacher_id = auth.uid() or student_id = auth.uid());

-- ---------- groups ---------------------------------------------------
drop policy if exists "groups teacher" on groups;
drop policy if exists "groups member"  on groups;
create policy "groups teacher" on groups for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and has_role('teacher'));
create policy "groups member" on groups for select
  using (exists (select 1 from group_students gs where gs.group_id = groups.id and gs.student_id = auth.uid()));

drop policy if exists "group students teacher" on group_students;
drop policy if exists "group students self"    on group_students;
drop policy if exists "group students leave"   on group_students;
create policy "group students teacher" on group_students for all
  using (owns_group(group_id))
  with check (owns_group(group_id) and is_teacher_of(student_id));
create policy "group students self" on group_students for select
  using (student_id = auth.uid() or is_parent_of(student_id));
create policy "group students leave" on group_students for delete
  using (student_id = auth.uid());

-- ---------- invite_codes ---------------------------------------------
drop policy if exists "invite codes owner" on invite_codes;
create policy "invite codes owner" on invite_codes for all
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and has_role(kind)
    and (group_id is null or owns_group(group_id))
  );

-- ---------- vocabulary_items -----------------------------------------
drop policy if exists "vocab read"   on vocabulary_items;
drop policy if exists "vocab insert" on vocabulary_items;
drop policy if exists "vocab update" on vocabulary_items;
drop policy if exists "vocab delete" on vocabulary_items;
create policy "vocab read" on vocabulary_items for select
  using (created_by = auth.uid() or can_read_vocab_item(id));
create policy "vocab insert" on vocabulary_items for insert
  with check (created_by = auth.uid());
create policy "vocab update" on vocabulary_items for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "vocab delete" on vocabulary_items for delete
  using (created_by = auth.uid());

-- ---------- word_sets ------------------------------------------------
-- Ученик не может изменить оригинальный набор учителя: писать может только владелец.
drop policy if exists "sets read"  on word_sets;
drop policy if exists "sets write" on word_sets;
create policy "sets read" on word_sets for select
  using (owner_id = auth.uid() or can_read_word_set(id));
create policy "sets write" on word_sets for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "set items read"  on word_set_items;
drop policy if exists "set items write" on word_set_items;
create policy "set items read" on word_set_items for select
  using (can_read_word_set(word_set_id));
create policy "set items write" on word_set_items for all
  using (can_edit_word_set(word_set_id))
  with check (can_edit_word_set(word_set_id) and can_read_vocab_item(vocabulary_item_id));

-- ---------- assignments ----------------------------------------------
drop policy if exists "assignments read"  on assignments;
drop policy if exists "assignments write" on assignments;
create policy "assignments read" on assignments for select
  using (assigned_by = auth.uid() or can_read_assignment(id));
create policy "assignments write" on assignments for all
  using (assigned_by = auth.uid())
  with check (assigned_by = auth.uid() and can_edit_word_set(word_set_id));

drop policy if exists "assignment students read"  on assignment_students;
drop policy if exists "assignment students write" on assignment_students;
create policy "assignment students read" on assignment_students for select
  using (can_view_student(student_id) or owns_assignment(assignment_id));
create policy "assignment students write" on assignment_students for all
  using (owns_assignment(assignment_id))
  with check (owns_assignment(assignment_id) and (is_teacher_of(student_id) or is_parent_of(student_id)));

-- ---------- word_progress / review_history ---------------------------
-- Изменять можно только собственный прогресс.
drop policy if exists "progress read"   on word_progress;
drop policy if exists "progress insert" on word_progress;
drop policy if exists "progress update" on word_progress;
create policy "progress read" on word_progress for select
  using (can_view_student(student_id));
create policy "progress insert" on word_progress for insert
  with check (student_id = auth.uid());
create policy "progress update" on word_progress for update
  using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "history read"   on review_history;
drop policy if exists "history insert" on review_history;
create policy "history read" on review_history for select
  using (can_view_student(student_id));
create policy "history insert" on review_history for insert
  with check (student_id = auth.uid());

-- ---------- favorites ------------------------------------------------
drop policy if exists "favorites own"  on favorites;
drop policy if exists "favorites read" on favorites;
create policy "favorites own" on favorites for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "favorites read" on favorites for select
  using (can_view_student(student_id));

-- ---------- user_settings --------------------------------------------
-- Родитель может менять дневную цель и доступные языки ребёнка.
drop policy if exists "settings read"   on user_settings;
drop policy if exists "settings insert" on user_settings;
drop policy if exists "settings update" on user_settings;
create policy "settings read" on user_settings for select
  using (can_view_student(user_id));
create policy "settings insert" on user_settings for insert
  with check (user_id = auth.uid());
create policy "settings update" on user_settings for update
  using (user_id = auth.uid() or is_parent_of(user_id))
  with check (user_id = auth.uid() or is_parent_of(user_id));
