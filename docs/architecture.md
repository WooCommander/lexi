# Архитектура Lexi

Основа — архитектура проекта **fair price** (модули, сервисы поверх Supabase, дизайн-система
с префиксом, токены → CSS-переменные, `useNotify`, офлайн-очередь). Ниже — что сохранено и что улучшено.

## Структура

```text
src/
  app/
    router/            сборка маршрутов модулей + guard (auth, роли)
    layouts/           MainLayout: sidebar (ПК) / top bar + tab bar (телефон), focus-режим тренировки
    navigation.ts      разделы меню по ролям — данными, а не ссылками в шаблоне
  api/supabase.ts
  design-system/       Lx* компоненты (аналог Fp* из fair price)
  styles/              tokens.scss → CSS-переменные, светлая/тёмная тема (body.dark-theme)
  shared/              composables (useNotify, useTheme), lib (даты, haptics, plural)
  modules/<module>/
    domain/            типы домена (camelCase) + мапперы строк БД (snake_case)
    lib/               чистая логика без Vue и Supabase — покрыта тестами
    services/          доступ к Supabase, статические классы, бросают ошибки
    state/             Pinia setup-stores (useXStore)
    composables/       Vue-обёртки (useLanguagePair)
    ui/                экраны и components/
    index.ts           маршруты модуля
```

Модули: `auth, languages, vocabulary, word-sets, training, assignments, students, teachers, groups, statistics, settings`.

## Что сохранено из fair price

| Паттерн | fair price | Lexi |
|---|---|---|
| Модуль = domain / services / state / ui | `modules/notes` | все модули |
| Сервис — статический класс над `supabase` | `NoteService` | `WordSetService`, `ProgressService`… |
| Store в форме `useXStore()` | ref-ы на уровне модуля | Pinia setup-store (требование ТЗ), тот же API |
| Дизайн-система с префиксом | `Fp*` | `Lx*` |
| Токены SCSS → CSS-переменные, `body.dark-theme` | `tokens.scss` | новая палитра |
| Уведомления + тактильный отклик | `useNotify`, `FpHaptics` | `useNotify`, `LxHaptics` (Vibration API) |
| Офлайн-очередь | `OfflinePriceQueue` | `OfflineAnswerQueue` — ответы не теряются без сети |
| SQL рядом с кодом | `db/*.sql` | `db/01…04` (повторно запускаемые) |

## Что улучшено

- **Маршруты по модулям.** Каждый `modules/*/index.ts` экспортирует свои маршруты; `app/router` их только собирает.
- **Guard ждёт инициализацию авторизации** (`auth.init()` возвращает общий промис) — прямая ссылка не уводит на `/login`.
- **Роли в `meta.roles`.** Если экран открыт под другой ролью, интерфейс переключается сам.
- **Домен отделён от БД.** В домене camelCase по ТЗ (`sourceLanguageId`), мапперы `*FromRow / *ToRow` стоят в domain-файлах.
- **Чистое ядро.** `SpacedRepetitionService`, `DifficultWordsService`, `sessionBuilder`, `studyMaterial`,
  `bulkParse`, `statistics/lib/aggregate` не зависят от Vue, Supabase и конкретного языка. Тесты: `npm test`.
- **RLS через security-definer хелперы** (`can_view_student`, `can_read_word_set`…), чтобы политики не уходили в рекурсию.

## Обучение

- **Интервалы:** 1 → 3 → 7 → 14 → 30 → 60 дней. С 7 дней слово «Изучено».
- **Ошибка** откатывает интервал на 2 ступени (30 → 7, 3 → 0 = повторить сегодня) и возвращает
  карточку в текущую тренировку (до 2 раз).
- **Практика:** если слов к повторению не хватает, тренировка добирает уже изучаемые слова. Счётчики
  обновляются, но интервал не продвигается.
- **Сложное слово:** не меньше 2 ошибок и не меньше 30 % ошибочных ответов. Такие слова получают приоритет при повторении.
- **Смешанный режим:** новое слово показывается прямым направлением, дальше в 70 % случаев — в более слабом направлении.
- **Дозированное задание:** `newWordsPerDay × (дней с начала + 1)` слов открыто; начатые слова не блокируются.
- **Изучаемый язык пары** определяется родным языком из настроек: English → Русский и Русский → English
  относятся к английскому.

## Связи и доступ

- Ученик подключается **кодом приглашения** (`ENG-7K4P` — группа учителя, `FAM-…` — родитель).
  Код проверяет `preview_invite_code`, подключение выполняет `redeem_invite_code` (security definer).
  Новый участник группы сразу получает её активные задания.
- Назначение группе разворачивается в `assignment_students`; `assignments.group_id` хранит источник.
- Задание родителя — это то же `assignments` с `source = 'parent'`.

## Не входит в MVP (заложено)

- `TrainingResult.Unsure` («Сомневаюсь») уже поддержан в SRS и БД (`result = 'unsure'`).
- Режимы «выбрать перевод / написать слово» строятся на тех же `TrainingCard`.
- Импорт CSV/Excel можно добавить через `parseBulkWords`.
- Озвучка: у полей есть `lang`, можно подключить Web Speech API.
