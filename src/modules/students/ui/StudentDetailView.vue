<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, UserMinus, X } from 'lucide-vue-next'
import {
  LxBadge,
  LxButton,
  LxCard,
  LxCheckbox,
  LxConfirmationModal,
  LxEmptyState,
  LxPageHeader,
  LxSegmented,
  LxSpinner,
} from '@/design-system'
import StudentStatsPanel from '@/modules/statistics/ui/components/StudentStatsPanel.vue'
import { useStudentsStore } from '../state/useStudentsStore'
import { StatisticsService, type StudentsStatsData } from '@/modules/statistics/services/StatisticsService'
import { SettingsService } from '@/modules/settings/services/SettingsService'
import { DAILY_GOALS, type UserSettings } from '@/modules/settings/domain/UserSettings'
import { ASSIGNMENT_STATUS_LABELS, AssignmentStatus } from '@/modules/assignments/domain/Assignment'
import { TrainingResult } from '@/modules/training/domain/Training'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'
import { formatDate } from '@/shared/lib/dates'

type Tab = 'stats' | 'assignments' | 'history' | 'settings'

const route = useRoute()
const router = useRouter()
const students = useStudentsStore()
const languages = useLanguagesStore()
const mySettings = useSettingsStore()
const { notify } = useNotify()

const studentId = computed(() => String(route.params.id))
const isParent = computed(() => students.kind === 'parent')
const name = computed(() => students.nameOf(studentId.value))

const tab = ref<Tab>('stats')
const tabs = computed(() => [
  { value: 'stats' as Tab, label: 'Статистика' },
  { value: 'assignments' as Tab, label: 'Задания' },
  { value: 'history' as Tab, label: 'История' },
  ...(isParent.value ? [{ value: 'settings' as Tab, label: 'Настройки' }] : []),
])

const data = ref<StudentsStatsData | null>(null)
const childSettings = ref<UserSettings | null>(null)
const isUnlinkOpen = ref(false)
const isSaving = ref(false)

onMounted(async () => {
  try {
    await Promise.all([students.load(), languages.load(), mySettings.load()])
    if (!students.byId.has(studentId.value)) {
      router.replace('/students')
      return
    }
    const [stats, settings] = await Promise.all([
      StatisticsService.loadForStudents([studentId.value]),
      SettingsService.fetch(studentId.value),
    ])
    data.value = stats
    childSettings.value = settings
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить данные ученика'), 'error')
  }
})

const setsById = computed(() => new Map((data.value?.sets ?? []).map(s => [s.id, s])))
const assignments = computed(() =>
  (data.value?.assignments ?? []).filter(a => a.studentIds.includes(studentId.value)),
)

/** История активности, сгруппированная по дням. */
const historyByDay = computed(() => {
  const d = data.value
  if (!d) return []
  const groups = new Map<string, { item: string; correct: boolean; time: string }[]>()
  for (const h of d.history.filter(x => x.studentId === studentId.value).slice(0, 200)) {
    const item = d.items.get(h.vocabularyItemId)
    const day = formatDate(h.createdAt)
    const list = groups.get(day) ?? []
    list.push({
      item: item ? `${item.sourceText} — ${item.targetText}` : '—',
      correct: h.result === TrainingResult.Correct,
      time: new Date(h.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    })
    groups.set(day, list)
  }
  return [...groups.entries()].map(([day, items]) => ({ day, items }))
})

// --- Настройки ребёнка (родитель) ---
const goalOptions = DAILY_GOALS.map(n => ({ value: n as number, label: String(n) }))

const toggleLanguage = (id: string, on: boolean) => {
  const s = childSettings.value
  if (!s) return
  const current = s.allowedLanguageIds ?? languages.languages.map(l => l.id)
  const next = on ? [...new Set([...current, id])] : current.filter(x => x !== id)
  s.allowedLanguageIds = next.length === languages.languages.length ? null : next
}

const saveSettings = async () => {
  if (!childSettings.value) return
  isSaving.value = true
  try {
    await SettingsService.save(childSettings.value, false)
    notify('Настройки ребёнка сохранены', 'success')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось сохранить'), 'error')
  } finally {
    isSaving.value = false
  }
}

const unlink = async () => {
  try {
    await students.unlink(studentId.value)
    router.replace('/students')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось отключить ученика'), 'error')
  }
}
</script>

<template>
  <div class="page">
    <LxPageHeader back="/students" :title="name" :subtitle="isParent ? 'Ребёнок' : 'Ученик'">
      <template #actions>
        <LxButton variant="secondary" @click="isUnlinkOpen = true"><UserMinus :size="20" /> Отключить</LxButton>
      </template>
    </LxPageHeader>

    <LxSegmented v-model="tab" :options="tabs" />

    <div v-if="!data" class="center"><LxSpinner /></div>

    <template v-else>
      <StudentStatsPanel v-if="tab === 'stats'" :data="data" :student-id="studentId"
        :native-language-id="childSettings?.nativeLanguageId ?? mySettings.settings?.nativeLanguageId ?? null" />

      <section v-else-if="tab === 'assignments'" class="section">
        <LxEmptyState v-if="!assignments.length" compact title="Заданий нет" />
        <div v-else class="lx-table-wrap">
          <table class="lx-table">
            <thead>
              <tr><th>Набор</th><th>Статус</th><th>Начало</th><th>Срок</th><th class="num">Новых в день</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in assignments" :key="a.id">
                <td>
                  {{ languages.flag(setsById.get(a.wordSetId)?.sourceLanguageId) }}
                  {{ setsById.get(a.wordSetId)?.name ?? 'Набор' }}
                  <LxBadge v-if="a.source === 'teacher'" tone="primary">учитель</LxBadge>
                  <LxBadge v-else>родитель</LxBadge>
                </td>
                <td>
                  <LxBadge :tone="a.status === AssignmentStatus.Active ? 'success' : 'neutral'">
                    {{ ASSIGNMENT_STATUS_LABELS[a.status] }}
                  </LxBadge>
                </td>
                <td>{{ formatDate(a.startAt) }}</td>
                <td>{{ formatDate(a.dueAt) }}</td>
                <td class="num">{{ a.newWordsPerDay ?? 'все' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="tab === 'history'" class="section">
        <LxEmptyState v-if="!historyByDay.length" compact title="Ещё нет ответов" />
        <LxCard v-for="g in historyByDay" :key="g.day" padding="sm">
          <h3 class="day">{{ g.day }} <span class="caption">{{ g.items.length }} ответов</span></h3>
          <ul class="history">
            <li v-for="(h, i) in g.items" :key="i">
              <Check v-if="h.correct" :size="18" class="ok" />
              <X v-else :size="18" class="bad" />
              <span class="history__word">{{ h.item }}</span>
              <span class="caption">{{ h.time }}</span>
            </li>
          </ul>
        </LxCard>
      </section>

      <section v-else-if="tab === 'settings' && childSettings" class="section">
        <LxCard class="stack">
          <LxSegmented v-model="childSettings.dailyGoal" :options="goalOptions" label="Дневная цель (слов)" />
          <div>
            <div class="lx-field__label">Языки, доступные ребёнку</div>
            <LxCheckbox v-for="l in languages.languages" :key="l.id"
              :model-value="!childSettings.allowedLanguageIds || childSettings.allowedLanguageIds.includes(l.id)"
              @update:model-value="v => toggleLanguage(l.id, v)">
              {{ l.flag }} {{ languages.label(l.id) }}
            </LxCheckbox>
          </div>
          <LxCheckbox v-model="childSettings.allowPersonalWords" label="Разрешить добавлять свои слова" />
          <LxButton :loading="isSaving" @click="saveSettings">Сохранить</LxButton>
        </LxCard>
      </section>
    </template>

    <LxConfirmationModal v-model:visible="isUnlinkOpen" :title="`Отключить ${name}?`"
      message="Вы больше не будете видеть прогресс. Ученик сможет подключиться снова по коду."
      confirm-text="Отключить" variant="danger" @confirm="unlink" />
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}

.day {
  font-size: var(--text-body);
  margin-bottom: var(--space-2);
}

.history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  &__word {
    flex: 1;
  }

  .ok { color: var(--color-success); }
  .bad { color: var(--color-error); }
}
</style>
