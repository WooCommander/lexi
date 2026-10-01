<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ClipboardList, Library, Plus, School, UsersRound } from 'lucide-vue-next'
import { LxBadge, LxButton, LxCard, LxPageHeader, LxProgressBar, LxSpinner, LxStatTile } from '@/design-system'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useStudentsStore } from '@/modules/students/state/useStudentsStore'
import { useGroupsStore } from '@/modules/groups/state/useGroupsStore'
import { useWordSetsStore } from '@/modules/word-sets/state/useWordSetsStore'
import { useAssignmentsStore } from '@/modules/assignments/state/useAssignmentsStore'
import { AssignmentStatus } from '@/modules/assignments/domain/Assignment'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { StatisticsService, progressMapFor, type StudentsStatsData } from '@/modules/statistics/services/StatisticsService'
import { formatPercent, historyAccuracy, summarize } from '@/modules/statistics/lib/aggregate'
import { DifficultWordsService } from '@/modules/training/lib/DifficultWordsService'
import { addDays, formatDate, startOfDay } from '@/shared/lib/dates'
import { mistakesLabel } from '@/shared/lib/plural'

const router = useRouter()
const auth = useAuthStore()
const students = useStudentsStore()
const groups = useGroupsStore()
const sets = useWordSetsStore()
const assignments = useAssignmentsStore()
const languages = useLanguagesStore()

const data = ref<StudentsStatsData | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  try {
    await Promise.all([languages.load(), students.load(), groups.load(), sets.load(), assignments.load()])
    data.value = await StatisticsService.loadForStudents(students.students.map(s => s.id))
  } finally {
    isLoading.value = false
  }
})

const active = computed(() => assignments.assignments.filter(a => a.status === AssignmentStatus.Active))
const setsById = computed(() => new Map(sets.sets.map(s => [s.id, s])))

const weekHistory = computed(() => (data.value?.history ?? []).filter(h => new Date(h.createdAt) >= addDays(new Date(), -7)))
const activeToday = computed(() => {
  const today = startOfDay(new Date())
  return new Set((data.value?.history ?? []).filter(h => new Date(h.createdAt) >= today).map(h => h.studentId)).size
})

/** Прогресс по каждому активному заданию: доля изученных слов у назначенных учеников. */
const assignmentProgress = computed(() =>
  active.value.slice(0, 6).map(a => {
    const d = data.value
    if (!d) return { a, share: 0 }
    const ids = d.entries.filter(e => e.wordSetId === a.wordSetId).map(e => e.item.id)
    let learned = 0
    let total = 0
    for (const sid of a.studentIds) {
      const s = summarize(ids, progressMapFor(d, sid))
      learned += s.learned
      total += s.total
    }
    return { a, share: total ? learned / total : 0 }
  }),
)

/** Слабые слова по всем ученикам. */
const weakWords = computed(() => {
  const d = data.value
  if (!d) return []
  const agg = new Map<string, { errors: number; students: number }>()
  for (const p of d.progress) {
    if (!DifficultWordsService.isDifficult(p)) continue
    const a = agg.get(p.vocabularyItemId) ?? { errors: 0, students: 0 }
    a.errors += p.wrongAnswers
    a.students++
    agg.set(p.vocabularyItemId, a)
  }
  return [...agg.entries()]
    .map(([id, a]) => ({ item: d.items.get(id), ...a }))
    .filter(r => !!r.item)
    .sort((x, y) => y.students - x.students || y.errors - x.errors)
    .slice(0, 8)
})
</script>

<template>
  <div class="page">
    <LxPageHeader :title="`Здравствуйте, ${auth.displayName}!`" subtitle="Как продвигаются ваши ученики">
      <template #actions>
        <LxButton variant="secondary" @click="router.push('/sets')"><Library :size="20" /> Наборы</LxButton>
        <LxButton @click="router.push('/assignments')"><Plus :size="20" /> Назначить</LxButton>
      </template>
    </LxPageHeader>

    <div v-if="isLoading" class="center"><LxSpinner /></div>

    <template v-else>
      <section class="grid-stats">
        <LxStatTile label="Учеников" :value="students.students.length" :hint="`занимались сегодня: ${activeToday}`" />
        <LxStatTile label="Групп" :value="groups.groups.length" />
        <LxStatTile label="Наборов" :value="sets.sets.length" />
        <LxStatTile label="Активных заданий" :value="active.length" tone="primary" />
        <LxStatTile label="Точность за неделю" :value="formatPercent(historyAccuracy(weekHistory))" tone="success" />
      </section>

      <div class="columns">
        <section class="section">
          <h2 class="section-title">
            Активные задания
            <LxButton size="sm" variant="ghost" @click="router.push('/assignments')">Все</LxButton>
          </h2>
          <LxCard v-if="!assignmentProgress.length" tone="soft" class="empty">
            <ClipboardList :size="24" /> Нет активных заданий
          </LxCard>
          <LxCard v-for="p in assignmentProgress" :key="p.a.id" padding="sm" class="task">
            <div class="row">
              <b class="spacer">
                {{ languages.flag(setsById.get(p.a.wordSetId)?.sourceLanguageId) }}
                {{ setsById.get(p.a.wordSetId)?.name ?? 'Набор' }}
              </b>
              <span v-if="p.a.dueAt" class="caption">до {{ formatDate(p.a.dueAt) }}</span>
            </div>
            <LxProgressBar :value="p.share * 100" tone="success" size="sm" />
            <span class="caption">Изучено {{ formatPercent(p.share) }} · учеников: {{ p.a.studentIds.length }}</span>
          </LxCard>
        </section>

        <section class="section">
          <h2 class="section-title">
            Слабые слова
            <LxButton size="sm" variant="ghost" @click="router.push('/teacher/stats')">Статистика</LxButton>
          </h2>
          <LxCard v-if="!weakWords.length" tone="soft" class="empty">Пока всё хорошо 👍</LxCard>
          <LxCard v-else padding="none">
            <ul class="weak">
              <li v-for="w in weakWords" :key="w.item!.id">
                <span><b>{{ w.item!.sourceText }}</b> <span class="muted">/ {{ w.item!.targetText }}</span></span>
                <LxBadge tone="error">{{ mistakesLabel(w.errors) }} · {{ w.students }} уч.</LxBadge>
              </li>
            </ul>
          </LxCard>
        </section>
      </div>

      <div class="quick">
        <LxCard interactive @click="router.push('/groups')"><School :size="28" /><b>Группы и коды</b></LxCard>
        <LxCard interactive @click="router.push('/students')"><UsersRound :size="28" /><b>Ученики</b></LxCard>
      </div>
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

.columns {
  display: grid;
  gap: var(--space-5);

  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
}

.empty {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
}

.task {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.weak {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);

    & + li {
      border-top: 2px solid var(--color-border);
    }
  }
}

.quick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);

  > * {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-primary);

    b {
      color: var(--color-text-primary);
    }
  }
}
</style>
