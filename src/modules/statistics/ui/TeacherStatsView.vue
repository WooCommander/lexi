<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BarChart3 } from 'lucide-vue-next'
import { LxBadge, LxCard, LxEmptyState, LxPageHeader, LxSelect, LxSpinner, LxStatTile } from '@/design-system'
import { StatisticsService, progressMapFor, studentItemIds, type StudentsStatsData } from '../services/StatisticsService'
import { formatPercent, historyAccuracy, summarize } from '../lib/aggregate'
import { accuracy, DifficultWordsService } from '@/modules/training/lib/DifficultWordsService'
import { studiedLanguageId } from '@/modules/languages/domain/Language'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useStudentsStore } from '@/modules/students/state/useStudentsStore'
import { useGroupsStore } from '@/modules/groups/state/useGroupsStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { addDays } from '@/shared/lib/dates'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const languages = useLanguagesStore()
const students = useStudentsStore()
const groups = useGroupsStore()
const settings = useSettingsStore()
const { notify } = useNotify()

const data = ref<StudentsStatsData | null>(null)
const groupId = ref<string | null>(typeof route.query.group === 'string' ? route.query.group : null)
const studentId = ref<string | null>(null)
const languageId = ref<string | null>(null)
const setId = ref<string | null>(null)
const periodDays = ref<number>(30)

const native = computed(() => settings.settings?.nativeLanguageId ?? null)

onMounted(async () => {
  try {
    await Promise.all([languages.load(), settings.load(), students.load(), groups.load()])
    data.value = await StatisticsService.loadForStudents(students.students.map(s => s.id))
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить статистику'), 'error')
  }
})

// --- Опции фильтров ---
const groupOptions = computed(() => groups.groups.map(g => ({ value: g.id, label: g.name })))
const studentOptions = computed(() =>
  students.students
    .filter(s => !groupId.value || groups.get(groupId.value)?.studentIds.includes(s.id))
    .map(s => ({ value: s.id, label: s.name })),
)
const mySets = computed(() => (data.value?.sets ?? []).filter(s => s.ownerId === auth.userId))
const setOptions = computed(() =>
  mySets.value
    .filter(s => !languageId.value || studiedLanguageId(s, native.value) === languageId.value)
    .map(s => ({ value: s.id, label: s.name })),
)
const periodOptions = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
]

const filteredStudentIds = computed(() => {
  let ids = students.students.map(s => s.id)
  if (groupId.value) ids = ids.filter(id => groups.get(groupId.value!)?.studentIds.includes(id))
  if (studentId.value) ids = ids.filter(id => id === studentId.value)
  return ids
})

const matchesLanguage = (itemId: string) => {
  if (!languageId.value) return true
  const item = data.value?.items.get(itemId)
  return !!item && studiedLanguageId(item, native.value) === languageId.value
}

const since = computed(() => addDays(new Date(), -periodDays.value))
const periodHistory = computed(() =>
  (data.value?.history ?? []).filter(
    h => filteredStudentIds.value.includes(h.studentId) && new Date(h.createdAt) >= since.value && matchesLanguage(h.vocabularyItemId),
  ),
)

// --- Таблица учеников: «Назначено / Изучено / Точность» по каждому языку ---
const studentRows = computed(() => {
  const d = data.value
  if (!d) return []
  const rows: { studentId: string; name: string; languageId: string; total: number; learned: number; accuracy: number | null; difficult: number }[] = []
  for (const sid of filteredStudentIds.value) {
    const progress = progressMapFor(d, sid)
    const byLang = new Map<string, string[]>()
    for (const id of studentItemIds(d, sid, setId.value)) {
      const item = d.items.get(id)
      if (!item) continue
      const lang = studiedLanguageId(item, native.value)
      if (languageId.value && lang !== languageId.value) continue
      byLang.set(lang, [...(byLang.get(lang) ?? []), id])
    }
    for (const [lang, ids] of byLang) {
      const s = summarize(ids, progress)
      const hist = periodHistory.value.filter(h => h.studentId === sid && ids.includes(h.vocabularyItemId))
      rows.push({
        studentId: sid,
        name: students.nameOf(sid),
        languageId: lang,
        total: s.total,
        learned: s.learned,
        accuracy: historyAccuracy(hist),
        difficult: ids.filter(id => DifficultWordsService.isDifficult(progress.get(id))).length,
      })
    }
  }
  return rows
})

// --- Наборы ---
const setRows = computed(() => {
  const d = data.value
  if (!d) return []
  return mySets.value
    .filter(s => !setId.value || s.id === setId.value)
    .filter(s => !languageId.value || studiedLanguageId(s, native.value) === languageId.value)
    .map(set => {
      const ids = d.entries.filter(e => e.wordSetId === set.id).map(e => e.item.id)
      const assigned = filteredStudentIds.value.filter(sid =>
        d.assignments.some(a => a.wordSetId === set.id && a.studentIds.includes(sid)),
      )
      let learned = 0
      let total = 0
      for (const sid of assigned) {
        const s = summarize(ids, progressMapFor(d, sid))
        learned += s.learned
        total += s.total
      }
      const hist = periodHistory.value.filter(h => assigned.includes(h.studentId) && ids.includes(h.vocabularyItemId))
      return { set, students: assigned.length, learnedShare: total ? learned / total : null, accuracy: historyAccuracy(hist) }
    })
    .filter(r => r.students > 0)
})

// --- Слова: точность по направлениям и в скольких учениках слово «сложное» ---
const wordRows = computed(() => {
  const d = data.value
  if (!d) return []
  const allowed = setId.value ? new Set(d.entries.filter(e => e.wordSetId === setId.value).map(e => e.item.id)) : null
  const agg = new Map<string, { fc: number; fw: number; rc: number; rw: number; difficultFor: number; students: number }>()
  for (const p of d.progress) {
    if (!filteredStudentIds.value.includes(p.studentId)) continue
    if (allowed && !allowed.has(p.vocabularyItemId)) continue
    if (!matchesLanguage(p.vocabularyItemId)) continue
    const a = agg.get(p.vocabularyItemId) ?? { fc: 0, fw: 0, rc: 0, rw: 0, difficultFor: 0, students: 0 }
    a.fc += p.forwardCorrect
    a.fw += p.forwardWrong
    a.rc += p.reverseCorrect
    a.rw += p.reverseWrong
    a.students++
    if (DifficultWordsService.isDifficult(p)) a.difficultFor++
    agg.set(p.vocabularyItemId, a)
  }
  return [...agg.entries()]
    .map(([id, a]) => ({
      item: d.items.get(id),
      forward: accuracy(a.fc, a.fw),
      reverse: accuracy(a.rc, a.rw),
      errors: a.fw + a.rw,
      difficultFor: a.difficultFor,
      students: a.students,
    }))
    .filter(r => !!r.item)
    .sort((a, b) => b.difficultFor - a.difficultFor || b.errors - a.errors)
    .slice(0, 50)
})

const totals = computed(() => ({
  students: filteredStudentIds.value.length,
  answers: periodHistory.value.length,
  accuracy: historyAccuracy(periodHistory.value),
  difficult: wordRows.value.filter(r => r.difficultFor > 0).length,
}))

const dirTitle = (item: { sourceLanguageId: string; targetLanguageId: string }, reverse: boolean) => {
  const [a, b] = reverse ? [item.targetLanguageId, item.sourceLanguageId] : [item.sourceLanguageId, item.targetLanguageId]
  return `${languages.label(a)} → ${languages.label(b)}`
}
</script>

<template>
  <div class="page">
    <LxPageHeader title="Статистика" subtitle="Прогресс учеников, наборов и отдельных слов" />

    <div v-if="!data" class="center"><LxSpinner /></div>

    <LxEmptyState v-else-if="!students.students.length" title="Пока нет учеников"
      description="Создайте группу и раздайте код приглашения — статистика появится после первых тренировок.">
      <template #icon><BarChart3 :size="36" /></template>
    </LxEmptyState>

    <template v-else>
      <LxCard class="filters">
        <LxSelect v-model="groupId" :options="groupOptions" label="Группа" placeholder="Все группы"
          @update:model-value="studentId = null" />
        <LxSelect v-model="studentId" :options="studentOptions" label="Ученик" placeholder="Все ученики" />
        <LxSelect v-model="languageId" :options="languages.options" label="Язык" placeholder="Все языки"
          @update:model-value="setId = null" />
        <LxSelect v-model="setId" :options="setOptions" label="Набор" placeholder="Все наборы" />
        <LxSelect :model-value="periodDays" :options="periodOptions" label="Период"
          @update:model-value="v => (periodDays = Number(v ?? 30))" />
      </LxCard>

      <section class="grid-stats">
        <LxStatTile label="Учеников" :value="totals.students" />
        <LxStatTile label="Ответов за период" :value="totals.answers" tone="primary" />
        <LxStatTile label="Точность" :value="formatPercent(totals.accuracy)" tone="success" />
        <LxStatTile label="Слабых слов" :value="totals.difficult" tone="error" />
      </section>

      <section class="section">
        <h2 class="section-title">Ученики</h2>
        <div class="lx-table-wrap">
          <table class="lx-table">
            <thead>
              <tr>
                <th>Ученик</th><th>Язык</th><th class="num">Назначено</th><th class="num">Изучено</th>
                <th class="num">Точность</th><th class="num">Сложных</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in studentRows" :key="r.studentId + r.languageId" class="clickable"
                @click="router.push(`/students/${r.studentId}`)">
                <td><b>{{ r.name }}</b></td>
                <td>{{ languages.flag(r.languageId) }} {{ languages.label(r.languageId) }}</td>
                <td class="num">{{ r.total }}</td>
                <td class="num">{{ r.learned }}</td>
                <td class="num">{{ formatPercent(r.accuracy) }}</td>
                <td class="num">{{ r.difficult }}</td>
              </tr>
              <tr v-if="!studentRows.length"><td colspan="6" class="muted">Нет данных под выбранные фильтры</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="setRows.length" class="section">
        <h2 class="section-title">Наборы</h2>
        <div class="lx-table-wrap">
          <table class="lx-table">
            <thead>
              <tr><th>Набор</th><th class="num">Учеников</th><th class="num">Изучено</th><th class="num">Точность</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in setRows" :key="r.set.id" class="clickable" @click="setId = r.set.id">
                <td>{{ languages.flag(r.set.sourceLanguageId) }} {{ r.set.name }}</td>
                <td class="num">{{ r.students }}</td>
                <td class="num">{{ formatPercent(r.learnedShare) }}</td>
                <td class="num">{{ formatPercent(r.accuracy) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="wordRows.length" class="section">
        <h2 class="section-title">Слова — слабые места</h2>
        <div class="lx-table-wrap">
          <table class="lx-table">
            <thead>
              <tr>
                <th>Слово</th><th class="num">Прямое</th><th class="num">Обратное</th>
                <th class="num">Ошибок</th><th>Сложное у</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in wordRows" :key="r.item!.id">
                <td><b>{{ r.item!.sourceText }}</b> <span class="muted">/ {{ r.item!.targetText }}</span></td>
                <td class="num" :title="dirTitle(r.item!, false)">{{ formatPercent(r.forward) }}</td>
                <td class="num" :title="dirTitle(r.item!, true)">{{ formatPercent(r.reverse) }}</td>
                <td class="num">{{ r.errors }}</td>
                <td>
                  <LxBadge v-if="r.difficultFor" tone="error">{{ r.difficultFor }} из {{ r.students }}</LxBadge>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}
</style>
