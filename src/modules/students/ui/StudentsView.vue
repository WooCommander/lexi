<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, UsersRound } from 'lucide-vue-next'
import { LxCard, LxEmptyState, LxPageHeader, LxProgressBar, LxSpinner } from '@/design-system'
import InviteCodeCard from '@/modules/groups/ui/components/InviteCodeCard.vue'
import { useStudentsStore } from '../state/useStudentsStore'
import { InviteService } from '@/modules/groups/services/InviteService'
import { invitePrefix } from '@/modules/groups/lib/inviteCode'
import { StatisticsService, progressMapFor, studentItemIds, type StudentsStatsData } from '@/modules/statistics/services/StatisticsService'
import { formatPercent, historyAccuracy, summarize } from '@/modules/statistics/lib/aggregate'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'
import { startOfDay } from '@/shared/lib/dates'

const router = useRouter()
const auth = useAuthStore()
const store = useStudentsStore()
const { notify } = useNotify()

const isParent = computed(() => store.kind === 'parent')
const code = ref<string | null>(null)
const isGenerating = ref(false)
const stats = ref<StudentsStatsData | null>(null)

const cards = computed(() =>
  store.students.map(s => {
    const d = stats.value
    if (!d) return { student: s, summary: null, today: 0, accuracy: null }
    const progress = progressMapFor(d, s.id)
    const today = startOfDay(new Date())
    const history = d.history.filter(h => h.studentId === s.id)
    return {
      student: s,
      summary: summarize(studentItemIds(d, s.id), progress),
      today: new Set(history.filter(h => new Date(h.createdAt) >= today).map(h => h.vocabularyItemId)).size,
      accuracy: historyAccuracy(history),
    }
  }),
)

onMounted(async () => {
  try {
    await store.load()
    const [personal, data] = await Promise.all([
      InviteService.fetchPersonal(auth.userId!, store.kind),
      StatisticsService.loadForStudents(store.students.map(s => s.id)),
    ])
    code.value = personal?.code ?? null
    stats.value = data
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить список'), 'error')
  }
})

const generate = async () => {
  isGenerating.value = true
  try {
    if (code.value) await InviteService.remove(code.value)
    code.value = await InviteService.create(store.kind, invitePrefix(undefined, store.kind))
  } catch (e) {
    notify(errorMessage(e, 'Не удалось создать код'), 'error')
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <div class="page">
    <LxPageHeader :title="isParent ? 'Мои дети' : 'Ученики'"
      :subtitle="isParent ? 'Прогресс, задания и настройки ребёнка' : 'Все подключённые ученики'" />

    <InviteCodeCard :code="code" :loading="isGenerating"
      :title="isParent ? 'Код для ребёнка' : 'Личный код учителя'"
      :hint="isParent
        ? 'Ребёнок вводит его в разделе «Профиль → Подключиться по коду».'
        : 'Подключает ученика без группы. Для класса создайте группу — у неё свой код.'"
      @generate="generate" />

    <div v-if="store.isLoading && !store.students.length" class="center"><LxSpinner /></div>

    <LxEmptyState v-else-if="!store.students.length" :title="isParent ? 'Ребёнок ещё не подключён' : 'Учеников пока нет'"
      description="Поделитесь кодом выше — после ввода кода ученик появится здесь.">
      <template #icon><UsersRound :size="36" /></template>
    </LxEmptyState>

    <div v-else class="grid-cards">
      <LxCard v-for="c in cards" :key="c.student.id" interactive class="student"
        @click="router.push(`/students/${c.student.id}`)">
        <div class="student__head">
          <span class="student__avatar">{{ c.student.name.charAt(0).toUpperCase() }}</span>
          <div class="student__name">{{ c.student.name }}</div>
          <ChevronRight :size="20" class="muted" />
        </div>
        <template v-if="c.summary">
          <LxProgressBar :value="c.summary.learned" :max="c.summary.total" tone="success" size="sm" />
          <div class="student__meta">
            <span>Изучено <b>{{ c.summary.learned }}</b> из {{ c.summary.total }}</span>
            <span>Точность <b>{{ formatPercent(c.accuracy) }}</b></span>
            <span>Сегодня <b>{{ c.today }}</b></span>
          </div>
        </template>
      </LxCard>
    </div>
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}

.student {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &__head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  &__avatar {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: var(--color-primary-soft);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.125rem;
  }

  &__name {
    flex: 1;
    font-size: var(--text-h3);
    font-weight: 900;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    font-size: var(--text-small);
    color: var(--color-text-secondary);

    b {
      color: var(--color-text-primary);
    }
  }
}
</style>
