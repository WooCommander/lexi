-- Проверки по итогам аудита: сценарии атак, которые должны быть закрыты.
begin;

insert into test.ids (name) values ('KID'), ('KIDP'), ('NOEMAIL');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  (test.id('KID'),  'kid@test.local',  '{"name": "Малыш"}', now()),
  (test.id('KIDP'), 'kidp@test.local', '{"name": "Мама малыша", "roles": ["parent"]}', now());
insert into auth.users (id, email, raw_user_meta_data) values (test.id('NOEMAIL'), null, '{}');
insert into invite_codes (code, owner_id, kind) values ('FAM-KIDP', test.id('KIDP'), 'parent');

-- ---------- Регистрация без почты ----------
select test.ok('регистрация без почты не падает, имя по умолчанию', (select name from profiles where id = test.id('NOEMAIL')) = 'user');

-- ---------- grant_admin только для подтверждённой почты ----------
select test.throws('grant_admin: неподтверждённая почта', $$select grant_admin('new2@test.local')$$);

-- ---------- Ребёнок не добавляет второго «родителя» ----------
select test.login('KID');
select test.affects('ребёнок подключается к своему родителю', $$select redeem_invite_code('FAM-KIDP')$$, 1);
select test.throws('управляемый ребёнок не подключает другого «родителя»', $$select redeem_invite_code('FAM-NEW1')$$);
select test.affects('но повторное подключение к тому же родителю безопасно', $$select redeem_invite_code('FAM-KIDP')$$, 1);
select test.throws('ребёнок не создаёт набор с источником «учитель»',
  $$insert into word_sets (name, source_language_id, target_language_id, source)
    select 'x', a.id, b.id, 'teacher' from languages a, languages b where a.code = 'en' and b.code = 'ru'$$);
select test.throws('и с источником «родитель»',
  $$insert into word_sets (name, source_language_id, target_language_id, source)
    select 'x', a.id, b.id, 'parent' from languages a, languages b where a.code = 'en' and b.code = 'ru'$$);
select test.affects('личный набор по-прежнему можно',
  $$insert into word_sets (name, source_language_id, target_language_id)
    select 'Мой', a.id, b.id from languages a, languages b where a.code = 'en' and b.code = 'ru'$$, 1);

-- ---------- Чужая группа в задании ----------
select test.login('T2');
select test.throws('нельзя создать задание с чужой группой',
  format('insert into assignments (word_set_id, group_id, status) values (%L, %L, ''active'')', test.id('SET2'), test.id('G1')));
select test.affects('своя группа — можно',
  format('insert into assignments (word_set_id, group_id, status) values (%L, %L, ''active'')', test.id('SET2'), test.id('G2')), 1);

-- ---------- Коды приглашений: без двойников по регистру ----------
select test.throws('код «eng-test» не создаётся рядом с «ENG-TEST» другого учителя',
  $$insert into invite_codes (code, owner_id, kind) values ('eng-test', auth.uid(), 'teacher')$$);
select test.affects('новый код сохраняется в верхнем регистре',
  $$insert into invite_codes (code, owner_id, kind) values (' t2 -x1 ', auth.uid(), 'teacher')$$, 1);
select test.ok('код нормализован', exists (select 1 from invite_codes where code = 'T2-X1'));

-- ---------- Прогресс и избранное — только по доступным словам ----------
select test.login('S2');
select test.throws('S2 не создаёт прогресс по недоступному слову (иначе слово откроется на чтение)',
  format('insert into word_progress (vocabulary_item_id) values (%L)', test.id('V2')));
select test.throws('и историю',
  format('insert into review_history (vocabulary_item_id, direction, result) values (%L, ''forward'', ''correct'')', test.id('V2')));
select test.throws('и избранное', format('insert into favorites (vocabulary_item_id) values (%L)', test.id('V2')));
select test.rows('слово по-прежнему недоступно', format('select 1 from vocabulary_items where id = %L', test.id('V2')), 0);

-- ---------- Последнего администратора не понизить и UPDATE-ом ----------
select test.login('ADM2');
select test.throws('нельзя сменить роль последнего админа',
  format('update user_roles set role = ''teacher'' where user_id = %L and role = ''admin''', test.id('ADM2')));
select test.ok('ADM2 всё ещё администратор', is_admin());

select test.logout();
commit;
