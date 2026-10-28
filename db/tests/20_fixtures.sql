-- Участники:
--   T1, T2   — учителя (T2 чужой, ни с кем не связан)
--   S1       — ученик T1 в группе G1 и ребёнок родителя P
--   S2       — «посторонний» ученик без связей
--   S3       — ученик T1 без группы
--   S5       — ещё один ученик группы G1 (одногруппник S1)
--   P, P2    — родитель ребёнка S1 / родитель без детей

begin;

insert into test.ids (name) values
  ('T1'), ('T2'), ('S1'), ('S2'), ('S3'), ('S5'), ('P'), ('P2'),
  ('G1'), ('G2'), ('SET1'), ('SET2'), ('SETS2'), ('V1'), ('V2'), ('V3'), ('A1'),
  ('SETP'), ('AP');

-- Регистрация идёт через триггер handle_new_user: профили, роли и настройки создаются сами.
insert into auth.users (id, email, raw_user_meta_data)
select test.id(u.name), lower(u.name) || '@test.local', u.meta::jsonb
from (values
  ('T1', '{"name": "Учитель 1", "roles": ["teacher"]}'),
  ('T2', '{"name": "Учитель 2", "roles": ["teacher"]}'),
  ('S1', '{"name": "Ученик 1", "roles": ["student"]}'),
  ('S2', '{"name": "Ученик 2", "roles": ["student"]}'),
  ('S3', '{"name": "Ученик 3"}'),
  ('S5', '{"name": "Ученик 5", "roles": ["student", "hacker"]}'),
  ('P',  '{"name": "Родитель", "roles": ["parent"]}'),
  ('P2', '{"name": "Родитель 2", "roles": ["parent"]}')
) as u(name, meta);

-- Данные, которые создают сами владельцы (в обход RLS — это подготовка стенда).
insert into groups (id, teacher_id, name) values
  (test.id('G1'), test.id('T1'), '6А'),
  (test.id('G2'), test.id('T2'), '6Б');

insert into invite_codes (code, owner_id, kind, group_id) values
  ('ENG-TEST', test.id('T1'), 'teacher', test.id('G1')),
  ('ENG-SOLO', test.id('T1'), 'teacher', null),
  ('FAM-TEST', test.id('P'),  'parent',  null);

insert into word_sets (id, name, source_language_id, target_language_id, owner_id, source)
select test.id(s.key), s.name, en.id, ru.id, test.id(s.owner), s.src
from (values
  ('SET1',  'Unit 1',     'T1', 'teacher'),
  ('SET2',  'Чужой набор', 'T2', 'teacher'),
  ('SETS2', 'Личный S2',  'S2', 'personal')
) as s(key, name, owner, src),
  (select id from languages where code = 'en') en,
  (select id from languages where code = 'ru') ru;

insert into vocabulary_items (id, source_language_id, target_language_id, source_text, target_text, created_by)
select test.id(v.key), en.id, ru.id, v.source_text, v.target_text, test.id(v.owner)
from (values
  ('V1', 'apple', 'яблоко',  'T1'),
  ('V2', 'house', 'дом',     'T2'),
  ('V3', 'tree',  'дерево',  'S2')
) as v(key, source_text, target_text, owner),
  (select id from languages where code = 'en') en,
  (select id from languages where code = 'ru') ru;

insert into word_set_items (word_set_id, vocabulary_item_id) values
  (test.id('SET1'),  test.id('V1')),
  (test.id('SET2'),  test.id('V2')),
  (test.id('SETS2'), test.id('V3'));

-- Подключение по кодам — настоящими вызовами от имени учеников.
select test.login('S1');
select redeem_invite_code(' eng-test ');   -- регистр и пробелы не важны
select redeem_invite_code('FAM-TEST');
select test.login('S3');
select redeem_invite_code('ENG-SOLO');
select test.logout();

-- Задание группе G1: учитель разворачивает его в assignment_students.
insert into assignments (id, assigned_by, word_set_id, group_id, source, new_words_per_day, status)
values (test.id('A1'), test.id('T1'), test.id('SET1'), test.id('G1'), 'teacher', 5, 'active');
insert into assignment_students (assignment_id, student_id) values (test.id('A1'), test.id('S1'));

-- S5 вступает в группу позже и должен получить уже активное задание.
select test.login('S5');
select redeem_invite_code('ENG-TEST');
select test.logout();

-- Прогресс и история: каждый ученик пишет только своё.
select test.login('S1');
insert into word_progress (vocabulary_item_id, status, correct_answers) values (test.id('V1'), 'learning', 1);
insert into review_history (vocabulary_item_id, direction, result) values (test.id('V1'), 'forward', 'correct');
insert into favorites (vocabulary_item_id) values (test.id('V1'));
select test.login('S5');
insert into word_progress (vocabulary_item_id, status, wrong_answers) values (test.id('V1'), 'learning', 1);
insert into review_history (vocabulary_item_id, direction, result) values (test.id('V1'), 'reverse', 'wrong');
select test.login('S2');
insert into word_progress (vocabulary_item_id, status, correct_answers) values (test.id('V3'), 'learning', 1);
insert into review_history (vocabulary_item_id, direction, result) values (test.id('V3'), 'forward', 'correct');
select test.logout();

-- Родитель ограничивает ребёнка (после этого S1 не должен суметь снять запреты сам).
select test.login('P');
update user_settings
  set allow_personal_words = false,
      allowed_language_ids = array[(select id from languages where code = 'en')]
  where user_id = test.id('S1');
select test.logout();

commit;
