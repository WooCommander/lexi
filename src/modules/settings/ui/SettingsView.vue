<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { KeyRound, LogOut, Moon, Sun } from 'lucide-vue-next'
import { LxButton, LxCard, LxCheckbox, LxInput, LxPageHeader, LxSegmented, LxSelect } from '@/design-system'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { ALL_ROLES, ROLE_LABELS, UserRole } from '@/modules/auth/domain/User'
import { useSettingsStore } from '../state/useSettingsStore'
import { DAILY_GOALS } from '../domain/UserSettings'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useStudyStore } from '@/modules/training/state/useStudyStore'
import { SESSION_SIZES } from '@/modules/training/domain/Training'
import { useTheme } from '@/shared/composables/useTheme'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const router = useRouter()
const auth = useAuthStore()
const store = useSettingsStore()
const languages = useLanguagesStore()
const study = useStudyStore()
const { isDark, toggleTheme } = useTheme()
const { notify } = useNotify()

const name = ref(auth.displayName)
const isStudent = computed(() => auth.hasRole(UserRole.Student))
const goalOptions = DAILY_GOALS.map(n => ({ value: n as number, label: String(n) }))
const sizeOptions = SESSION_SIZES.map(n => ({ value: n as number, label: String(n) }))

/** Языки, по которым у ученика есть слова, — для целей по языку. */
const studiedLanguages = computed(() => study.languageSummaries.map(s => s.languageId))

onMounted(async () => {
  await Promise.all([languages.load(), store.load()])
  if (isStudent.value) await study.load()
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
        <LxCheckbox v-for="r in ALL_ROLES" :key="r" :model-value="auth.hasRole(r)"
          :disabled="auth.hasRole(r) && auth.roles.length === 1" @update:model-value="v => toggleRole(r, v)">
          {{ ROLE_LABELS[r] }}
        </LxCheckbox>
      </div>
    </LxCard>

    <LxCard v-if="store.settings" class="stack">
      <h2 class="section-title">Обучение</h2>
      <LxSelect :model-value="store.settings.nativeLanguageId" :options="languages.options" label="Мой родной язык"
        @update:model-value="v => save({ nativeLanguageId: v ? String(v) : null })" />
      <p class="caption">По нему определяется изучаемый язык: «English → Русский» и «Русский → English» — это английский.</p>

      <template v-if="isStudent">
        <LxSegmented :model-value="store.settings.dailyGoal" :options="goalOptions" label="Дневная цель (слов)"
          @update:model-value="v => save({ dailyGoal: v })" />
        <LxSegmented :model-value="store.settings.sessionSize" :options="sizeOptions" label="Слов в тренировке по умолчанию"
          @update:model-value="v => save({ sessionSize: v })" />

        <div v-if="studiedLanguages.length" class="stack">
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

.join {
  color: var(--color-primary);

  b {
    color: var(--color-text-primary);
  }
}
</style>
