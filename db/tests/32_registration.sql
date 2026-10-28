-- Регистрация нового аккаунта: триггер handle_new_user и первые действия нового пользователя.
begin;

insert into test.ids (name) values ('NEW1'), ('NEW2'), ('NEW3'), ('NEW4');

insert into auth.users (id, email, raw_user_meta_data)
select test.id(u.name), u.email, u.meta::jsonb
from (values
  ('NEW1', 'new1@test.local', '{"name": "Новая Анна", "roles": ["parent", "teacher"]}'),
  ('NEW2', 'plain@test.local', '{}'),
  ('NEW3', 'new3@test.local', '{"name": "Ник", "roles": ["admin", "student"]}'),
  ('NEW4', 'new4@test.local', '{"name": "   ", "roles": "student"}')
) as u(name, email, meta);

-- ---------- Что создал триггер ----------
select test.ok('новый аккаунт: профиль с именем из формы', (select name from profiles where id = test.id('NEW1')) = 'Новая Анна');
select test.ok('новый аккаунт: выбранные роли (родитель + учитель)',
  (select array_agg(role order by role) from user_roles where user_id = test.id('NEW1')) = array['parent', 'teacher']);
select test.ok('новый аккаунт: настройки и родной язык по умолчанию',
  (select native_language_id from user_settings where user_id = test.id('NEW1')) = (select id from languages where code = 'ru')
  and (select daily_goal from user_settings where user_id = test.id('NEW1')) = 10);
select test.ok('без данных в форме: имя из почты, роль ученика',
  (select name from profiles where id = test.id('NEW2')) = 'plain'
  and (select array_agg(role) from user_roles where user_id = test.id('NEW2')) = array['student']);
select test.ok('роль admin при регистрации отбрасывается, остальные сохраняются',
  (select array_agg(role) from user_roles where user_id = test.id('NEW3')) = array['student']);
select test.ok('пустое имя и roles не массивом — не ломают регистрацию',
  (select name from profiles where id = test.id('NEW4')) = 'new4'
  and (select array_agg(role) from user_roles where user_id = test.id('NEW4')) = array['student']);

-- ---------- Новый пользователь работает как положено ----------
select test.login('NEW1');
select test.rows('видит свой профиль и только его', 'select 1 from profiles', 1);
select test.rows('видит свои роли', 'select 1 from user_roles', 2);
select test.rows('видит свои настройки', 'select 1 from user_settings', 1);
select test.rows('не видит чужие наборы и прогресс', 'select 1 from word_sets union all select 1 from word_progress', 0);
select test.affects('создаёт личный набор',
  $$insert into word_sets (name, source_language_id, target_language_id)
    select 'Первый', a.id, b.id from languages a, languages b where a.code = 'en' and b.code = 'ru'$$, 1);
select test.affects('создаёт код родителя (есть роль)', $$insert into invite_codes (code, owner_id, kind) values ('FAM-NEW1', auth.uid(), 'parent')$$, 1);
select test.affects('создаёт группу (есть роль учителя)', $$insert into groups (name) values ('Новая группа')$$, 1);
select test.throws('роль администратора себе не выдаст', $$insert into user_roles (user_id, role) values (auth.uid(), 'admin')$$);
select test.affects('может добавить себе роль ученика (у него нет родителя)',
  $$insert into user_roles (user_id, role) values (auth.uid(), 'student')$$, 1);
select test.affects('и подключиться по коду учителя (code из демо-стенда)', $$select redeem_invite_code('ENG-SOLO')$$, 1);

select test.login('NEW2');
select test.affects('новый ученик подключается по коду учителя', $$select redeem_invite_code('ENG-TEST')$$, 1);
select test.rows('после подключения видит набор учителя', format('select 1 from word_sets where id = %L', test.id('SET1')), 1);

select test.logout();
commit;
