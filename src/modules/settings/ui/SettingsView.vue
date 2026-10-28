<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, KeyRound, LogOut, Moon, RefreshCw, Sun } from 'lucide-vue-next'
import { LxButton, LxCard, LxCheckbox, LxInput, LxPageHeader, LxSegmented, LxSelect } from '@/design-system'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { ROLE_LABELS, SELF_ROLES, UserRole } from '@/modules/auth/domain/User'
import { useSettingsStore } from '../state/useSettingsStore'
import { DAILY_GOALS } from '../domain/UserSettings'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useStudyStore } from '@/modules/training/state/useStudyStore'
import { SESSION_SIZES } from '@/modules/training/domain/Training'
import { useTheme } from '@/shared/composables/useTheme'
import { useUpdateStore } from '@/modules/updates/state/useUpdateStore'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'
import { LinkService } from '@/modules/students/services/LinkService'
import { useSpeech } from '@/shared/composables/useSpeech'

const router = useRouter()
const auth = useAuthStore()
const store = useSettingsStore()
const languages = useLanguagesStore()
const study = useStudyStore()
const { isDark, toggleTheme } = useTheme()
const updates = useUpdateStore()
const { notify } = useNotify()
const speech = useSpeech()

const name = ref(auth.displayName)
/** У ребёнка с родителем цели, родной язык, роли и личные слова задаёт родитель (то же правило есть в БД). */
const isManaged = ref(false)
const managedKnown = ref(false)
/** Пока не знаем, есть ли родитель, управляемые поля закрыты — чтобы их нельзя было «на секунду» изменить. */
const locked = computed(() => isManaged.value || (isStudent.value && !managedKnown.value))
const isStudent = computed(() => auth.hasRole(UserRole.Student))
const goalOptions = DAILY_GOALS.map(n => ({ value: n as number, label: String(n) }))
const sizeOptions = SESSION_SIZES.map(n => ({ value: n as number, label: String(n) }))

/** Языки, по которым у ученика есть слова, — для целей по языку. */
const studiedLanguages = computed(() => study.languageSummaries.map(s => s.languageId))

onMounted(async () => {
  await Promise.all([languages.load(), store.load()])
  if (isStudent.value) await study.load()
  try {
    isManaged.value = !!auth.userId && (await LinkService.hasParent(auth.userId))
  } catch {
    isManaged.value = false
  } finally {
    managedKnown.value = true
  }
})

watch(() => auth.displayName, v => (name.value = v))

const save = async (patch: Parameters<typeof store.save>[0]) => {
  try {
    await store.save(patch)
  } catch (e) {
    notify(errorMessage(e, 'Не удалось сохранить'), 'error')
  }
}

const saveName = async () => {
  if (!name.value.trim() || name.value.trim() === auth.displayName) return
  try {
    await auth.updateName(name.value)
    notify('Имя сохранено', 'success')
  } catch (e) {
    notify(errorMessage(e), 'error')
  }
}

const toggleRole = async (role: UserRole, on: boolean) => {
  try {
    if (on) await auth.addRole(role)
    else await auth.removeRole(role)
  } catch (e) {
    notify(errorMessage(e), 'error')
  }
}

const setLanguageGoal = (languageId: string, value: number | null) => {
  const goals = { ...(store.settings?.languageGoals ?? {}) }
  if (value) goals[languageId] = value
  else delete goals[languageId]
  save({ languageGoals: goals })
}

const logout = async () => {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="page page--narrow">
    <LxPageHeader title="Профиль" :subtitle="auth.user?.email" />

    <LxCard class="stack">
      <h2 class="section-title">О себе</h2>
      <form class="name-row" @submit.prevent="saveName">
        <LxInput v-model="name" label="Имя" />
        <LxButton type="submit" variant="secondary" :disabled="!name.trim() || name.trim() === auth.displayName">Сохранить</LxButton>
      </form>
      <div>
        <div class="lx-field__label">Роли</div>
        <LxCheckbox v-for="r in SELF_ROLES" :key="r" :model-value="auth.hasRole(r)"
          :disabled="locked || (auth.hasRole(r) && auth.roles.length === 1)" @update:model-value="v => toggleRole(r, v)">
          {{ ROLE_LABELS[r] }}
        </LxCheckbox>
        <p v-if="isManaged" class="caption">Роли меняет родитель.</p>
      </div>
    </LxCard>

    <LxCard v-if="store.settings" class="stack">
      <h2 class="section-title">Обучение</h2>
      <LxSelect :model-value="store.settings.nativeLanguageId" :options="languages.options" label="Мой родной язык"
        :disabled="locked" @update:model-value="v => save({ nativeLanguageId: v ? String(v) : null })" />
      <p v-if="isManaged" class="caption">Родной язык, цели и доступные языки задаёт родитель.</p>
      <p class="caption">По нему определяется изучаемый язык: «English → Русский» и «Русский → English» — это английский.</p>

      <LxCheckbox v-if="speech.isSupported" v-model="speech.autoSpeak.value">
        Озвучивать слова автоматически (на этом устройстве)
      </LxCheckbox>

      <template v-if="isStudent">
        <div v-if="locked">
          <div class="lx-field__label">Дневная цель</div>
          <p>{{ store.settings.dailyGoal }} слов<template v-if="isManaged"> — её задаёт родитель</template></p>
        </div>
        <LxSegmented v-else :model-value="store.settings.dailyGoal" :options="goalOptions" label="Дневная цель (слов)"
          @update:model-value="v => save({ dailyGoal: v })" />
        <LxSegmented :model-value="store.settings.sessionSize" :options="sizeOptions" label="Слов в тренировке по умолчанию"
          @update:model-value="v => save({ sessionSize: v })" />

        <div v-if="studiedLanguages.length && !locked" class="stack">
          <div class="lx-field__label">Цель по языкам (пусто — общая)</div>
          <div v-for="id in studiedLanguages" :key="id" class="goal-row">
            <span>{{ languages.flag(id) }} {{ languages.label(id) }}</span>
            <LxSelect :model-value="store.settings.languageGoals[id] ?? null"
              :options="goalOptions.map(o => ({ value: o.value, label: `${o.label} слов` }))" placeholder="Общая"
              @update:model-value="v => setLanguageGoal(id, v ? Number(v) : null)" />
          </div>
        </div>
      </template>
    </LxCard>

    <LxCard v-if="isStudent" class="row join">
      <KeyRound :size="24" />
      <div class="spacer">
        <b>Подключиться по коду</b>
        <p class="caption">К учителю, группе или родителю</p>
      </div>
      <LxButton variant="secondary" @click="router.push('/join')">Ввести код</LxButton>
    </LxCard>

    <LxCard class="stack version" :class="{ 'has-update': updates.available }">
      <div class="row">
        <div class="spacer">
          <b>Версия приложения</b>
          <p class="caption">
            v{{ updates.currentVersion }} ·
            <template v-if="!updates.isSupported">веб-версия обновляется автоматически</template>
            <template v-else-if="updates.available">доступна v{{ updates.available.version }}</template>
            <template v-else>актуальная версия</template>
          </p>
        </div>
        <LxButton v-if="updates.available" size="sm" @click="updates.install()">Обновить</LxButton>
        <LxButton v-else-if="updates.isSupported" size="sm" variant="secondary" :loading="updates.isChecking"
          @click="updates.check()">
          <RefreshCw :size="18" /> Проверить
        </LxButton>
      </div>
      <p v-if="updates.available?.notes" class="version__notes">{{ updates.available.notes }}</p>
      <LxButton variant="ghost" block @click="router.push('/changelog')">
        Что нового <ChevronRight :size="18" />
      </LxButton>
    </LxCard>

    <div class="row">
      <LxButton variant="secondary" block @click="toggleTheme">
        <Sun v-if="isDark" :size="20" /><Moon v-else :size="20" />
        {{ isDark ? 'Светлая тема' : 'Тёмная тема' }}
      </LxButton>
      <LxButton variant="secondary" block @click="logout"><LogOut :size="20" /> Выйти</LxButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.name-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);

  > :first-child {
    flex: 1;
  }
}

.goal-row {
  display: grid;
  grid-template-columns: 1fr 160px;
  align-items: center;
  gap: var(--space-3);
  font-weight: 700;
}

.version {
  &.has-update {
    border-color: var(--color-primary);
  }

  &__notes {
    white-space: pre-line;
    font-size: var(--text-small);
    color: var(--color-text-secondary);
  }
}

.join {
  color: var(--color-primary);

  b {
    color: var(--color-text-primary);
  }
}
</style>
