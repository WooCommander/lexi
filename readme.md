# Lexi — изучение иностранных слов

Веб-приложение (PWA) для ребёнка, родителя и учителя: карточки, интервальное повторение,
задания и статистика. Ядро не привязано к языку — слова хранятся как языковые пары
`source → target` (English → Русский, Română → Русский, Українська → Русский …).

Стек: Vue 3 + TypeScript (`<script setup>`), Vite, Vue Router, Pinia, Supabase (Postgres, Auth, RLS).

## Запуск

1. Создайте проект в Supabase и выполните в **SQL Editor** по порядку:
   `db/01_schema.sql` → `db/02_functions.sql` → `db/03_rls.sql` → `db/04_seed.sql`.
   Скрипты можно запускать повторно.
2. `cp .env.example .env` и укажите `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. В Supabase → Authentication → URL Configuration добавьте `http://localhost:5173/login`
   в Redirect URLs (подтверждение почты и восстановление пароля).
4. Запустите:

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # юнит-тесты ядра (vitest)
npm run build      # проверка типов + сборка PWA
```

## Демо-вход

Выполните `db/05_demo.sql` (после 01–04) — он создаёт три аккаунта с данными. Пароль у всех `demo1234`:

| Роль | Email |
|---|---|
| Учитель «Анна Петровна» | `demo.teacher@example.com` |
| Ученик «Алексей» | `demo.student@example.com` |
| Родитель «Мама Алексея» | `demo.parent@example.com` |

В `npm run dev` на экране входа есть кнопки быстрого демо-входа. Коды приглашения: `ENG-DEMO` (группа 6А), `FAM-DEMO` (родитель).
Скрипт только для разработки: не запускайте его в боевом проекте.

## Как попробовать все роли

1. Зарегистрируйте учителя (роль «Учитель») → «Группы» → создайте группу, скопируйте код.
2. «Наборы слов» → новый набор → добавьте слова списком (`apple - яблоко`) → «Назначить» группе.
3. Зарегистрируйте ученика (в другом браузере / инкогнито) → «Профиль → Подключиться по коду».
4. Ученик тренируется — учитель видит прогресс в «Статистике».
5. Родитель создаёт код в «Мои дети», ребёнок вводит его так же.

Ученик без учителя может сразу добавить стартовый набор на главном экране.

## Android (APK с самообновлением — как в fair price)

Требуется Android Studio (JDK берётся из её `jbr`, путь в `android/gradle.properties`) и Android SDK
(`android/local.properties`, файл не коммитится).

Для выгрузки релиза добавьте в `.env.local` ключ **service_role** (Supabase → Project Settings → API Keys):

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Выпуск новой версии

1. Поднимите версию: `npm version patch --no-git-tag-version` (или `minor` / `major`).
2. Добавьте запись в `src/modules/updates/changelog.ts` — из неё берётся текст «Что нового».
3. `npm run release`, команда делает всё по шагам:
   - `build` → `cap sync android` → `sync-android-version` (versionCode = 1.2.3 → 10203)
   - `build-debug-apk` (`android/app/build/outputs/apk/debug/app-debug.apk`)
   - `upload-release` → bucket `releases`: `lexi-<версия>.apk`, `app-latest.apk`, затем `version.json`

Приложение при запуске и при возврате на экран читает `version.json`. Если версия новее —
показывает баннер «Доступно обновление» и кнопку «Обновить» в профиле: APK скачивается в
браузере, Android предлагает установить его поверх.

Другие команды: `npm run update-android` (только синхронизировать проект), `npm run get-android-version`,
`npm run android:icons` (перегенерировать иконки и сплэш из `public/icon.svg`).
Первую установку делайте из `app-latest.apk`; установка из «неизвестных источников» должна быть разрешена.

Архитектура и соглашения: [docs/architecture.md](docs/architecture.md).
