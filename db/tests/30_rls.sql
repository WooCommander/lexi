-- Проверки RLS и функций. Всё в одной транзакции, итог — в 99_report.sql.
begin;

-- ---------- Регистрация и приглашения (до разграничения доступа) ----------
select test.ok('регистрация: роль по умолчанию — student',
  (select array_agg(role) from user_roles where user_id = test.id('S3')) = array['student']);
select test.ok('регистрация: неизвестные роли отбрасываются',
  (select array_agg(role order by role) from user_roles where user_id = test.id('S5')) = array['student']);
select test.ok('регистрация: родной язык по умолчанию — русский',
  (select native_language_id from user_settings where user_id = test.id('S1')) = (select id from languages where code = 'ru'));
select test.ok('код группы: ученик стал учеником учителя и участником группы',
  exists (select 1 from teacher_students where teacher_id = test.id('T1') and student_id = test.id('S1'))
  and exists (select 1 from group_students where group_id = test.id('G1') and student_id = test.id('S1')));
select test.ok('код родителя: связь родитель → ребёнок создана',
  exists (select 1 from parent_students where parent_id = test.id('P') and student_id = test.id('S1')));
select test.ok('код без группы: ученик связан с учителем, но не в группе',
  exists (select 1 from teacher_students where teacher_id = test.id('T1') and student_id = test.id('S3'))
  and not exists (select 1 from group_students where student_id = test.id('S3')));
select test.ok('новый участник группы получает активное задание',
  exists (select 1 from assignment_students where assignment_id = test.id('A1') and student_id = test.id('S5')));

select test.login('S2');
select test.throws('redeem: несуществующий код', $$select redeem_invite_code('NOPE-0000')$$);
select test.login('T1');
select test.throws('redeem: собственный код', $$select redeem_invite_code('ENG-TEST')$$);
select test.login('S1');
select test.affects('redeem: повторное подключение безопасно (идемпотентно)', $$select redeem_invite_code('ENG-TEST')$$, 1);
select test.ok('preview: ученик видит владельца и группу',
  (select owner_name from preview_invite_code('eng-test')) = 'Учитель 1');

select test.anon();
select test.throws('redeem: аноним не может подключаться', $$select redeem_invite_code('ENG-TEST')$$);
select test.throws('preview: аноним не может подбирать коды', $$select * from preview_invite_code('ENG-TEST')$$);

-- ---------- Аноним ----------
select test.anon();
select test.rows('аноним: профили закрыты', 'select 1 from profiles', 0);
select test.rows('аноним: наборы закрыты', 'select 1 from word_sets', 0);
select test.rows('аноним: слова закрыты', 'select 1 from vocabulary_items', 0);
select test.rows('аноним: прогресс закрыт', 'select 1 from word_progress', 0);
select test.rows('аноним: коды приглашений закрыты', 'select 1 from invite_codes', 0);
select test.rows('аноним: справочник языков открыт', 'select 1 from languages', 4);
select test.throws('аноним: нельзя создать набор',
  $$insert into word_sets (name, source_language_id, target_language_id, owner_id)
    select 'x', a.id, b.id, test.id('T1') from languages a, languages b where a.code = 'en' and b.code = 'ru'$$);

-- ---------- Ученик S1 ----------
select test.login('S1');
select test.rows('S1: видит назначенный набор учителя', format('select 1 from word_sets where id = %L', test.id('SET1')), 1);
select test.rows('S1: видит слова назначенного набора', format('select 1 from vocabulary_items where id = %L', test.id('V1')), 1);
select test.rows('S1: не видит набор другого учителя', format('select 1 from word_sets where id = %L', test.id('SET2')), 0);
select test.rows('S1: не видит слова другого учителя', format('select 1 from vocabulary_items where id = %L', test.id('V2')), 0);
select test.rows('S1: не видит личный набор S2', format('select 1 from word_sets where id = %L', test.id('SETS2')), 0);
select test.rows('S1: не видит слова S2', format('select 1 from vocabulary_items where id = %L', test.id('V3')), 0);
select test.rows('S1: видит только свой прогресс', 'select 1 from word_progress', 1);
select test.rows('S1: не видит прогресс одногруппника S5',
  format('select 1 from word_progress where student_id = %L', test.id('S5')), 0);
select test.rows('S1: не видит историю одногруппника S5',
  format('select 1 from review_history where student_id = %L', test.id('S5')), 0);
select test.rows('S1: не видит избранное и настройки чужих',
  format('select 1 from user_settings where user_id = %L', test.id('S5')), 0);
select test.rows('S1: в group_students видит только себя', 'select 1 from group_students', 1);
select test.rows('S1: не видит профиль постороннего S2', format('select 1 from profiles where id = %L', test.id('S2')), 0);
select test.rows('S1: не видит профиль одногруппника S5', format('select 1 from profiles where id = %L', test.id('S5')), 0);
select test.rows('S1: видит профили учителя и родителя', format('select 1 from profiles where id in (%L, %L)', test.id('T1'), test.id('P')), 2);
select test.rows('S1: не видит коды приглашений учителя', 'select 1 from invite_codes', 0);

select test.affects('S1: не может переименовать набор учителя',
  format('update word_sets set name = ''hacked'' where id = %L', test.id('SET1')), 0);
select test.affects('S1: не может удалить набор учителя',
  format('delete from word_sets where id = %L', test.id('SET1')), 0);
select test.affects('S1: не может изменить слово учителя',
  format('update vocabulary_items set target_text = ''x'' where id = %L', test.id('V1')), 0);
select test.affects('S1: не может удалить слово учителя',
  format('delete from vocabulary_items where id = %L', test.id('V1')), 0);
select test.throws('S1: не может добавить слово в набор учителя',
  format('insert into word_set_items (word_set_id, vocabulary_item_id) values (%L, %L)', test.id('SET1'), test.id('V1')));
select test.affects('S1: не может убрать слово из набора учителя',
  format('delete from word_set_items where word_set_id = %L', test.id('SET1')), 0);
select test.throws('S1: не может подключить себя к учителю',
  format('insert into teacher_students (teacher_id, student_id) values (%L, %L)', test.id('T2'), test.id('S1')));
select test.throws('S1: не может назначить себе родителя',
  format('insert into parent_students (parent_id, student_id) values (%L, %L)', test.id('P2'), test.id('S1')));
select test.throws('S1: не может сам вступить в группу',
  format('insert into group_students (group_id, student_id) values (%L, %L)', test.id('G2'), test.id('S1')));
select test.throws('S1: не может выписать код приглашения (нет роли учителя)',
  $$insert into invite_codes (code, owner_id, kind) values ('ENG-EVIL', auth.uid(), 'teacher')$$);

select test.throws('S1: не может писать прогресс за другого',
  format('insert into word_progress (student_id, vocabulary_item_id) values (%L, %L)', test.id('S2'), test.id('V1')));
select test.throws('S1: не может писать историю за другого',
  format('insert into review_history (student_id, vocabulary_item_id, direction, result) values (%L, %L, ''forward'', ''correct'')', test.id('S2'), test.id('V1')));
select test.affects('S1: не может править чужой прогресс',
  format('update word_progress set correct_answers = 999 where student_id = %L', test.id('S5')), 0);
select test.affects('S1: может править свой прогресс',
  $$update word_progress set correct_answers = correct_answers + 1$$, 1);
select test.throws('S1: результат «сомневаюсь» допустим, мусорный — нет',
  format('insert into review_history (vocabulary_item_id, direction, result) values (%L, ''forward'', ''maybe'')', test.id('V1')));
select test.affects('S1: результат «сомневаюсь» сохраняется',
  format('insert into review_history (vocabulary_item_id, direction, result) values (%L, ''reverse'', ''unsure'')', test.id('V1')), 1);

select test.affects('S1: может создать личный набор',
  $$insert into word_sets (name, source_language_id, target_language_id)
    select 'Мой', a.id, b.id from languages a, languages b where a.code = 'en' and b.code = 'ru'$$, 1);
select test.throws('S1: не может создать набор от чужого имени',
  format($f$insert into word_sets (name, source_language_id, target_language_id, owner_id)
    select 'Подмена', a.id, b.id, %L from languages a, languages b where a.code = 'en' and b.code = 'ru'$f$, test.id('T1')));
select test.throws('S1: нельзя создать язык (не учитель и не родитель)',
  $$insert into languages (code, name) values ('de', 'Deutsch')$$);

-- настройки: свои можно, чужие — нет, ограничения родителя — не снять
select test.affects('S1: меняет свою дневную цель', $$update user_settings set daily_goal = 15$$, 1);
select test.affects('S1: не меняет настройки одногруппника',
  format('update user_settings set daily_goal = 99 where user_id = %L', test.id('S5')), 0);
select test.throws('S1: не может вернуть личные слова, запрещённые родителем',
  $$update user_settings set allow_personal_words = true$$);
select test.throws('S1: не может расширить список языков, заданный родителем',
  $$update user_settings set allowed_language_ids = null$$);
select test.affects('S1: сохранение без изменения ограничений проходит (upsert из приложения)',
  $$update user_settings set allow_personal_words = allow_personal_words, daily_goal = 12$$, 1);

-- ---------- Учитель T1 ----------
select test.login('T1');
select test.rows('T1: видит свой набор', format('select 1 from word_sets where id = %L', test.id('SET1')), 1);
select test.rows('T1: не видит набор T2', format('select 1 from word_sets where id = %L', test.id('SET2')), 0);
select test.rows('T1: не видит слова T2', format('select 1 from vocabulary_items where id = %L', test.id('V2')), 0);
select test.rows('T1: не видит личный набор постороннего ученика', format('select 1 from word_sets where id = %L', test.id('SETS2')), 0);
select test.rows('T1: видит прогресс своих учеников (S1, S5)', 'select 1 from word_progress', 2);
select test.rows('T1: не видит прогресс постороннего S2', format('select 1 from word_progress where student_id = %L', test.id('S2')), 0);
select test.rows('T1: видит историю своих учеников (S1 — 2, S5 — 1)', 'select 1 from review_history', 3);
select test.rows('T1: не видит историю постороннего S2', format('select 1 from review_history where student_id = %L', test.id('S2')), 0);
select test.rows('T1: видит профили учеников, но не посторонних',
  format('select 1 from profiles where id in (%L, %L, %L, %L)', test.id('S1'), test.id('S3'), test.id('S5'), test.id('S2')), 3);
select test.rows('T1: видит учеников своей группы', format('select 1 from group_students where group_id = %L', test.id('G1')), 2);
select test.rows('T1: не видит группу T2', format('select 1 from groups where id = %L', test.id('G2')), 0);
select test.rows('T1: видит только свои коды', 'select 1 from invite_codes', 2);
select test.rows('T1: не видит настройки постороннего', format('select 1 from user_settings where user_id = %L', test.id('S2')), 0);

select test.throws('T1: не может писать прогресс за ученика',
  format('insert into word_progress (student_id, vocabulary_item_id) values (%L, %L)', test.id('S3'), test.id('V1')));
select test.affects('T1: не может править прогресс ученика',
  format('update word_progress set correct_answers = 999 where student_id = %L', test.id('S1')), 0);
select test.affects('T1: не может менять настройки ученика (это право родителя)',
  format('update user_settings set daily_goal = 99 where user_id = %L', test.id('S1')), 0);
select test.throws('T1: не может назначить чужой набор',
  format('insert into assignments (assigned_by, word_set_id) values (auth.uid(), %L)', test.id('SET2')));
select test.throws('T1: не может добавить постороннего ученика в задание',
  format('insert into assignment_students (assignment_id, student_id) values (%L, %L)', test.id('A1'), test.id('S2')));
select test.affects('T1: может добавить своего ученика в задание',
  format('insert into assignment_students (assignment_id, student_id) values (%L, %L)', test.id('A1'), test.id('S3')), 1);
select test.throws('T1: не может добавить постороннего в группу',
  format('insert into group_students (group_id, student_id) values (%L, %L)', test.id('G1'), test.id('S2')));
select test.affects('T1: может добавить своего ученика в группу',
  format('insert into group_students (group_id, student_id) values (%L, %L)', test.id('G1'), test.id('S3')), 1);
select test.throws('T1: не может выписать код родителя (нет роли)',
  $$insert into invite_codes (code, owner_id, kind) values ('FAM-EVIL', auth.uid(), 'parent')$$);
select test.throws('T1: не может привязать код к чужой группе',
  format('insert into invite_codes (code, owner_id, kind, group_id) values (''ENG-STEAL'', auth.uid(), ''teacher'', %L)', test.id('G2')));
select test.affects('T1: может добавить язык', $$insert into languages (code, name) values ('de', 'Deutsch')$$, 1);
select test.affects('T1: не может править сид-язык',
  $$update languages set name = 'Hacked' where code = 'en'$$, 0);
select test.affects('T1: может редактировать свой набор',
  format('update word_sets set description = ''ok'' where id = %L', test.id('SET1')), 1);

-- ---------- Другой учитель T2 ----------
select test.login('T2');
select test.rows('T2: не видит набор T1', format('select 1 from word_sets where id = %L', test.id('SET1')), 0);
select test.rows('T2: не видит прогресс чужих учеников', 'select 1 from word_progress', 0);
select test.rows('T2: не видит чужую историю', 'select 1 from review_history', 0);
select test.rows('T2: не видит группу T1', format('select 1 from groups where id = %L', test.id('G1')), 0);
select test.rows('T2: не видит коды T1', format('select 1 from invite_codes where owner_id = %L', test.id('T1')), 0);
select test.rows('T2: не видит профиль ученика T1', format('select 1 from profiles where id = %L', test.id('S1')), 0);

-- ---------- Родитель P ----------
select test.login('P');
select test.rows('P: видит прогресс ребёнка', format('select 1 from word_progress where student_id = %L', test.id('S1')), 1);
select test.rows('P: не видит прогресс чужих детей', 'select 1 from word_progress where student_id <> auth.uid() and student_id <> ''' || test.id('S1') || '''', 0);
select test.rows('P: видит историю ребёнка', format('select 1 from review_history where student_id = %L', test.id('S1')), 2);
select test.rows('P: видит задания учителя ребёнка', format('select 1 from assignments where id = %L', test.id('A1')), 1);
select test.rows('P: видит назначенный ребёнку набор и слова',
  format('select 1 from word_sets where id = %L union all select 1 from vocabulary_items where id = %L', test.id('SET1'), test.id('V1')), 2);
select test.rows('P: не видит набор постороннего учителя', format('select 1 from word_sets where id = %L', test.id('SET2')), 0);
select test.rows('P: видит избранное ребёнка', format('select 1 from favorites where student_id = %L', test.id('S1')), 1);
select test.rows('P: видит профиль ребёнка', format('select 1 from profiles where id = %L', test.id('S1')), 1);
select test.rows('P: не видит профиль учителя ребёнка (достаточно того, что он знает о связи)',
  format('select 1 from profiles where id = %L', test.id('T1')), 0);
select test.rows('P: не видит профиль чужого ученика', format('select 1 from profiles where id = %L', test.id('S2')), 0);
select test.rows('P: видит связь учителя с ребёнком', format('select 1 from teacher_students where student_id = %L', test.id('S1')), 1);
select test.throws('P: не может писать прогресс за ребёнка',
  format('insert into word_progress (student_id, vocabulary_item_id) values (%L, %L)', test.id('S1'), test.id('V1')));
select test.affects('P: меняет дневную цель ребёнка', format('update user_settings set daily_goal = 20 where user_id = %L', test.id('S1')), 1);
select test.affects('P: не меняет настройки чужого ребёнка', format('update user_settings set daily_goal = 20 where user_id = %L', test.id('S2')), 0);
select test.affects('P: может снять собственное ограничение (ребёнок — нет)',
  format('update user_settings set allow_personal_words = true where user_id = %L', test.id('S1')), 1);
select test.affects('P: создаёт родительский набор',
  format($f$insert into word_sets (id, name, source_language_id, target_language_id, source)
    select %L, 'Мама', a.id, b.id, 'parent' from languages a, languages b where a.code = 'en' and b.code = 'ru'$f$, test.id('SETP')), 1);
select test.affects('P: назначает свой набор ребёнку',
  format('insert into assignments (id, word_set_id, source) values (%L, %L, ''parent'')', test.id('AP'), test.id('SETP')), 1);
select test.affects('P: добавляет ребёнка в своё задание',
  format('insert into assignment_students (assignment_id, student_id) values (%L, %L)', test.id('AP'), test.id('S1')), 1);
select test.throws('P: не может назначить набор постороннему ребёнку',
  format('insert into assignment_students (assignment_id, student_id) values (%L, %L)', test.id('AP'), test.id('S2')));
select test.throws('P: не может назначить чужой набор учителя',
  format('insert into assignments (word_set_id, source) values (%L, ''parent'')', test.id('SET1')));

select test.login('P2');
select test.rows('P2 (без детей): не видит ничего чужого', 'select 1 from word_progress', 0);
select test.rows('P2: не видит наборы', 'select 1 from word_sets', 0);
select test.rows('P2: не видит профиль чужого ребёнка', format('select 1 from profiles where id = %L', test.id('S1')), 0);
select test.affects('P2: не меняет настройки чужого ребёнка', format('update user_settings set daily_goal = 1 where user_id = %L', test.id('S1')), 0);

-- ---------- Разрыв связей ----------
select test.login('S1');
select test.affects('S1: может отключиться от родителя', $$delete from parent_students$$, 1);
select test.login('P');
select test.rows('P после отключения: прогресс ребёнка закрыт', format('select 1 from word_progress where student_id = %L', test.id('S1')), 0);
select test.rows('P после отключения: ребёнок не виден', format('select 1 from profiles where id = %L', test.id('S1')), 0);

select test.logout();
commit;
