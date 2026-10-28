-- Администратор: права, серверные агрегаты и защита от злоупотреблений.
begin;

-- ученик S1 освоил слово — для рейтингов (подготовка стенда, в обход RLS)
update word_progress set status = 'learned' where student_id = test.id('S1');

-- ожидаемые числа берём до входа под пользователем: сами таблицы ему могут быть недоступны
select (select count(*) from profiles) as n_profiles, (select count(*) from review_history) as n_history \gset

-- ---------- Роль администратора нельзя получить через регистрацию ----------
select test.ok('регистрация с ролью admin не даёт админа (получает student)',
  (select array_agg(role) from user_roles where user_id = test.id('HACK')) = array['student']);
select test.ok('grant_admin выдал роль по почте', exists (select 1 from user_roles where user_id = test.id('ADM') and role = 'admin'));

select test.login('HACK');
select test.throws('grant_admin недоступен пользователю', $$select grant_admin('hack@test.local')$$);
select test.throws('обычному пользователю закрыта сводка', $$select admin_overview()$$);
select test.throws('обычному пользователю закрыт список пользователей', $$select * from admin_list_users()$$);
select test.throws('обычный пользователь не удаляет других', format('select admin_delete_user(%L)', test.id('S2')));
select test.throws('обычному пользователю закрыты агрегаты', $$select * from admin_teachers()$$);
select test.anon();
select test.throws('аноним: сводка закрыта', $$select admin_overview()$$);
select test.throws('аноним: grant_admin закрыт', $$select grant_admin('x@test.local')$$);

select test.login('T1');
select test.throws('учитель не видит рейтинг всех пользователей', $$select * from admin_top_learners(5)$$);
select test.rows('учитель по-прежнему видит только своих (RLS не ослаблен)', 'select 1 from profiles where id = ' || quote_literal(test.id('S2')), 0);

-- ---------- Администратор видит и может всё ----------
select test.login('ADM');
select test.ok('админ: is_admin()', is_admin());
select test.rows('админ видит все профили', 'select 1 from profiles', :n_profiles);
select test.rows('админ видит чужие наборы', format('select 1 from word_sets where id in (%L, %L, %L)', test.id('SET1'), test.id('SET2'), test.id('SETS2')), 3);
select test.rows('админ видит прогресс любого ученика', format('select 1 from word_progress where student_id = %L', test.id('S2')), 1);
select test.rows('админ видит чужие коды приглашений', 'select 1 from invite_codes', 3);
select test.rows('админ видит всю историю ответов', 'select 1 from review_history', :n_history);
select test.affects('админ меняет настройки любого пользователя',
  format('update user_settings set daily_goal = 15 where user_id = %L', test.id('S1')), 1);
select test.affects('админ редактирует чужой набор',
  format('update word_sets set description = ''admin'' where id = %L', test.id('SET2')), 1);
select test.affects('админ удаляет чужое слово', format('delete from vocabulary_items where id = %L', test.id('V3')), 1);
select test.affects('админ выдаёт пользователю роль учителя',
  format('insert into user_roles (user_id, role) values (%L, ''teacher'')', test.id('S3')), 1);
select test.affects('админ снимает роль', format('delete from user_roles where user_id = %L and role = ''teacher''', test.id('S3')), 1);
select test.affects('админ правит справочник языков', $$update languages set display_name = 'Английский' where code = 'en'$$, 1);

-- ---------- Серверные агрегаты ----------
select test.ok('admin_overview: считает пользователей', (admin_overview() ->> 'users')::int >= 10);
select test.ok('admin_overview: роли в разрезе', (admin_overview() -> 'by_role' ->> 'student')::int >= 4);
select test.ok('admin_overview: освоенные слова', (admin_overview() ->> 'learned_words')::int >= 1);
select test.ok('рейтинг: лидер — S1 (освоил слово)', (select student_id from admin_top_learners(5) limit 1) = test.id('S1'));
select test.ok('рейтинг: лимит соблюдается', (select count(*) from admin_top_learners(1)) = 1);
select test.ok('список пользователей содержит почту и роли',
  (select email from admin_list_users() where id = test.id('T1')) = 't1@test.local'
  and (select roles from admin_list_users() where id = test.id('T1')) = array['teacher']);
select test.ok('список пользователей: последний вход', (select last_sign_in_at from admin_list_users() where id = test.id('T1')) is not null);
select test.ok('активность: ровно N дней подряд', (select count(*) from admin_activity(14)) = 14);
select test.ok('активность: сегодня есть ответы', (select answers from admin_activity(7) order by day desc limit 1) >= 3);
select test.ok('регистрации: ровно N дней', (select count(*) from admin_signups(10)) = 10);
select test.ok('распределение: пять корзин', (select count(*) from admin_learned_distribution()) = 5);
select test.ok('распределение: S1 в корзине «1–9»', (select students from admin_learned_distribution() where bucket = '1–9') >= 1);
select test.ok('языки: английский учат и освоили слово', (select learned from admin_language_stats() where code = 'en') >= 1);
select test.ok('популярные слова: яблоко среди самых отвечаемых', exists (select 1 from admin_popular_words(10) where source_text = 'apple'));
select test.ok('учителя: T1 с учениками и освоенным словом',
  (select students from admin_teachers() where teacher_id = test.id('T1')) >= 3
  and (select learned from admin_teachers() where teacher_id = test.id('T1')) >= 1);
select test.ok('учителя: у T1 есть наборы, группы и задания',
  (select sets from admin_teachers() where teacher_id = test.id('T1')) = 1
  and (select groups from admin_teachers() where teacher_id = test.id('T1')) = 1
  and (select assignments from admin_teachers() where teacher_id = test.id('T1')) = 1);

-- ---------- Удаление пользователя ----------
select test.throws('админ не может удалить себя', format('select admin_delete_user(%L)', test.id('ADM')));
select test.affects('админ удаляет пользователя целиком', format('select admin_delete_user(%L)', test.id('S5')), 1);
select test.ok('после удаления нет профиля, прогресса и истории',
  not exists (select 1 from profiles where id = test.id('S5'))
  and not exists (select 1 from word_progress where student_id = test.id('S5'))
  and not exists (select 1 from review_history where student_id = test.id('S5')));

-- ---------- Последнего администратора не снять ----------
select test.affects('админ может снять роль у себя, пока есть другой админ',
  format('delete from user_roles where user_id = %L and role = ''admin''', test.id('ADM')), 1);
select test.throws('после этого ADM уже не админ', $$select admin_overview()$$);
select test.login('ADM2');
select test.throws('последнего администратора снять нельзя',
  format('delete from user_roles where user_id = %L and role = ''admin''', test.id('ADM2')));
select test.ok('ADM2 остаётся администратором', is_admin());

select test.logout();
commit;
