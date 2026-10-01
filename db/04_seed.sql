-- =====================================================================
--  LEXI — справочник языков
--  Новые языки добавляются строкой в этой таблице — без изменения
--  структуры слов, наборов и прогресса.
-- =====================================================================

insert into languages (code, name, native_name, display_name, flag, created_by) values
  ('en', 'English',   'English',    'Английский',             '🇬🇧', null),
  ('ru', 'Russian',   'Русский',    'Русский',                '🇷🇺', null),
  ('ro', 'Romanian',  'Română',     'Молдавский / румынский', '🇷🇴', null),
  ('uk', 'Ukrainian', 'Українська', 'Украинский',             '🇺🇦', null)
on conflict (code) do update
  set name         = excluded.name,
      native_name  = excluded.native_name,
      display_name = excluded.display_name,
      flag         = excluded.flag;
