<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Archive, CheckCheck, ClipboardList, Plus, Trash2 } from 'lucide-vue-next'
import {
  LxBadge,
  LxButton,
  LxCard,
  LxConfirmationModal,
  LxEmptyState,
  LxIconButton,
  LxPageHeader,
  LxSegmented,
  LxSpinner,
} from '@/design-system'
import AssignModal from './components/AssignModal.vue'
import { useAssignmentsStore } from '../state/useAssignmentsStore'
import { ASSIGNMENT_STATUS_LABELS, AssignmentStatus, type AssignmentInput, type LearningAssignment } from '../domain/Assignment'
import { useWordSetsStore } from '@/modules/word-sets/state/useWordSetsStore'
import { useStudentsStore } from '@/modules/students/state/useStudentsStore'
import { useGroupsStore } from '@/modules/groups/state/useGroupsStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { UserRole } from '@/modules/auth/domain/User'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'
import { formatDate } from '@/shared/lib/dates'

const route = useRoute()
const auth = useAuthStore()
const store = useAssignmentsStore()
const sets = useWordSetsStore()
const students = useStudentsStore()
const groups = useGroupsStore()
const languages = useLanguagesStore()
const { notify } = useNotify()

const isTeacher = computed(() => auth.activeRole === UserRole.Teacher)
const filter = ref<'active' | 'done' | 'all'>('active')
const filterOptions = [
  { value: 'active' as const, label: 'Активные' },
  { value: 'done' as const, label: 'Завершённые' },
  { value: 'all' as const, label: 'Все' },
]

const isAssignOpen = ref(false)
const isSaving = ref(false)
const pendingDelete = ref<LearningAssignment | null>(null)
const initialSetId = ref<string | null>(typeof route.query.set === 'string' ? route.query.set : null)
const initialGroupId = ref<string | null>(typeof route.query.group === 'string' ? route.query.group : null)

const setsById = computed(() => new Map(sets.sets.map(s => [s.id, s])))
const visible = computed(() =>
  store.assignments.filter(a =>
    filter.value === 'all'
      ? true
      : filter.value === 'active'
        ? a.status === AssignmentStatus.Active || a.status === AssignmentStatus.Draft
        : a.status === AssignmentStatus.Completed || a.status === AssignmentStatus.Archived,
  ),
)

const targetLabel = (a: LearningAssignment) => {
  if (a.groupId) return `Группа «${groups.get(a.groupId)?.name ?? '—'}»`
  const names = a.studentIds.map(id => students.nameOf(id))
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} и ещё ${names.length - 3}` : names.join(', ')
}

const isOverdue = (a: LearningAssignment) =>
  a.status === AssignmentStatus.Active && !!a.dueAt && a.dueAt < new Date().toISOString().slice(0, 10)

onMounted(async () => {
  try {
    await Promise.all([languages.load(), sets.load(), students.load(), store.load(), isTeacher.value ? groups.load() : null])
    if (initialSetId.value || initialGroupId.value) isAssignOpen.value = true
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить задания'), 'error')
  }
})

const create = async (input: AssignmentInput) => {
  isSaving.value = true
  try {
    await store.create(input)
    isAssignOpen.value = false
    initialSetId.value = null
    initialGroupId.value = null
    notify('Набор назначен', 'success')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось назначить'), 'error')
  } finally {
    isSaving.value = false
  }
}

const setStatus = async (a: LearningAssignment, status: AssignmentStatus) => {
  try {
    await store.setStatus(a.id, status)
  } catch (e) {
    notify(errorMessage(e), 'error')
  }
}

const remove = async () => {
  if (!pendingDelete.value) return
  try {
    await store.remove(pendingDelete.value.id)
  } catch (e) {
    notify(errorMessage(e), 'error')
  }
}
</script>

<template>
  <div class="page">
    <LxPageHeader title="Задания" :subtitle="isTeacher ? 'Наборы, назначенные ученикам и группам' : 'Слова, которые вы добавили ребёнку'">
      <template #actions>
        <LxButton :disabled="!sets.sets.length" @click="isAssignOpen = true"><Plus :size="20" /> Назначить</LxButton>
      </template>
    </LxPageHeader>

    <LxSegmented v-model="filter" :options="filterOptions" />

    <div v-if="store.isLoading && !store.assignments.length" class="center"><LxSpinner /></div>

    <LxEmptyState v-else-if="!visible.length" title="Заданий нет"
      :description="sets.sets.length ? 'Выберите набор и назначьте его ученику или группе.' : 'Сначала создайте набор слов.'">
      <template #icon><ClipboardList :size="36" /></template>
    </LxEmptyState>

    <div v-else class="list">
      <LxCard v-for="a in visible" :key="a.id" class="task">
        <div class="task__main">
          <div class="task__title">
            {{ languages.flag(setsById.get(a.wordSetId)?.sourceLanguageId) }}
            {{ setsById.get(a.wordSetId)?.name ?? 'Набор' }}
          </div>
          <div class="muted">{{ targetLabel(a) }}</div>
          <div class="task__meta">
            <LxBadge :tone="a.status === AssignmentStatus.Active ? 'success' : 'neutral'">
              {{ ASSIGNMENT_STATUS_LABELS[a.status] }}
            </LxBadge>
            <LxBadge v-if="isOverdue(a)" tone="error">просрочено</LxBadge>
            <span class="caption">с {{ formatDate(a.startAt) }}</span>
            <span v-if="a.dueAt" class="caption">до {{ formatDate(a.dueAt) }}</span>
            <span v-if="a.newWordsPerDay" class="caption">по {{ a.newWordsPerDay }} новых в день</span>
          </div>
        </div>
        <div class="task__actions">
          <LxIconButton v-if="a.status === AssignmentStatus.Active" label="Завершить"
            @click="setStatus(a, AssignmentStatus.Completed)">
            <CheckCheck :size="20" />
          </LxIconButton>
          <LxIconButton v-if="a.status !== AssignmentStatus.Archived" label="В архив"
            @click="setStatus(a, AssignmentStatus.Archived)">
            <Archive :size="20" />
          </LxIconButton>
          <LxIconButton label="Удалить" variant="danger" @click="pendingDelete = a"><Trash2 :size="20" /></LxIconButton>
        </div>
      </LxCard>
    </div>

    <AssignModal v-model:visible="isAssignOpen" :sets="sets.sets" :students="students.students"
      :groups="isTeacher ? groups.groups : []" :source="isTeacher ? 'teacher' : 'parent'" :initial-set-id="initialSetId"
      :initial-group-id="initialGroupId" :loading="isSaving" @submit="create" />

    <LxConfirmationModal :visible="!!pendingDelete" title="Удалить задание?"
      message="Слова пропадут у учеников из тренировок, но их прогресс сохранится." confirm-text="Удалить"
      variant="danger" @update:visible="v => !v && (pendingDelete = null)" @confirm="remove" />
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.task {
  display: flex;
  align-items: center;
  gap: var(--space-3);

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    font-size: var(--text-h3);
    font-weight: 900;
  }

  &__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__actions {
    display: flex;
  }
}
</style>
