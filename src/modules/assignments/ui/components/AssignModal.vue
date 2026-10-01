<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LxButton, LxCheckbox, LxInput, LxModal, LxSegmented, LxSelect } from '@/design-system'
import type { AssignmentInput, AssignmentSource } from '../../domain/Assignment'
import type { WordSet } from '@/modules/word-sets/domain/WordSet'
import type { Profile } from '@/modules/auth/domain/User'
import type { StudentGroup } from '@/modules/groups/domain/Group'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { toISODate } from '@/shared/lib/dates'
import { wordsLabel } from '@/shared/lib/plural'

type Target = 'student' | 'students' | 'group'

const props = defineProps<{
  visible: boolean
  sets: WordSet[]
  students: Profile[]
  groups: StudentGroup[]
  source: AssignmentSource
  initialSetId?: string | null
  initialGroupId?: string | null
  loading?: boolean
}>()

const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'submit', input: AssignmentInput): void }>()
const languages = useLanguagesStore()

const setId = ref<string | null>(null)
const target = ref<Target>('student')
const studentId = ref<string | null>(null)
const studentIds = ref<string[]>([])
const groupId = ref<string | null>(null)
const startAt = ref('')
const dueAt = ref('')
const perDay = ref<number | null>(null)

watch(
  () => props.visible,
  v => {
    if (!v) return
    setId.value = props.initialSetId ?? props.sets[0]?.id ?? null
    groupId.value = props.initialGroupId ?? null
    target.value = props.initialGroupId ? 'group' : 'student'
    studentId.value = null
    studentIds.value = []
    startAt.value = toISODate(new Date())
    dueAt.value = ''
    perDay.value = null
  },
)

const targetOptions = computed(() => [
  { value: 'student' as Target, label: 'Ученику' },
  { value: 'students' as Target, label: 'Нескольким' },
  ...(props.groups.length ? [{ value: 'group' as Target, label: 'Группе' }] : []),
])

const setOptions = computed(() =>
  props.sets.map(s => ({ value: s.id, label: `${languages.flag(s.sourceLanguageId)} ${s.name} (${wordsLabel(s.itemCount)})` })),
)
const studentOptions = computed(() => props.students.map(s => ({ value: s.id, label: s.name })))
const groupOptions = computed(() => props.groups.map(g => ({ value: g.id, label: `${g.name} (${g.studentIds.length})` })))

const selectedSet = computed(() => props.sets.find(s => s.id === setId.value))
const resolvedStudentIds = computed(() => {
  if (target.value === 'student') return studentId.value ? [studentId.value] : []
  if (target.value === 'students') return studentIds.value
  return props.groups.find(g => g.id === groupId.value)?.studentIds ?? []
})

/** Подсказка дозированного изучения: «60 слов по 10 в день — 6 дней». */
const dosingHint = computed(() => {
  const total = selectedSet.value?.itemCount ?? 0
  if (!perDay.value || !total) return 'Пусто — все слова доступны сразу'
  return `${wordsLabel(total)} по ${perDay.value} в день — ${Math.ceil(total / perDay.value)} дн.`
})

const error = computed(() => (dueAt.value && startAt.value && dueAt.value < startAt.value ? 'Срок раньше даты начала' : ''))
const canSubmit = computed(
  () => !!setId.value && (resolvedStudentIds.value.length > 0 || (target.value === 'group' && !!groupId.value)) && !error.value,
)

const toggleStudent = (id: string, on: boolean) => {
  studentIds.value = on ? [...studentIds.value, id] : studentIds.value.filter(x => x !== id)
}

const submit = () => {
  if (!canSubmit.value) return
  emit('submit', {
    wordSetId: setId.value!,
    studentIds: resolvedStudentIds.value,
    groupId: target.value === 'group' ? groupId.value ?? undefined : undefined,
    source: props.source,
    startAt: startAt.value || undefined,
    dueAt: dueAt.value || undefined,
    newWordsPerDay: perDay.value && perDay.value > 0 ? perDay.value : undefined,
  })
}
</script>

<template>
  <LxModal :visible="visible" title="Назначить набор" @update:visible="emit('update:visible', $event)">
    <div class="stack">
      <LxSelect v-model="setId" :options="setOptions" label="Набор слов" placeholder="Выберите набор" />

      <LxSegmented v-model="target" :options="targetOptions" label="Кому" />

      <LxSelect v-if="target === 'student'" v-model="studentId" :options="studentOptions" placeholder="Выберите ученика" />
      <div v-else-if="target === 'students'" class="checks">
        <LxCheckbox v-for="s in students" :key="s.id" :model-value="studentIds.includes(s.id)"
          @update:model-value="v => toggleStudent(s.id, v)">
          {{ s.name }}
        </LxCheckbox>
        <p v-if="!students.length" class="caption">Нет подключённых учеников</p>
      </div>
      <LxSelect v-else v-model="groupId" :options="groupOptions" placeholder="Выберите группу" />

      <div class="dates">
        <LxInput v-model="startAt" type="date" label="Дата начала" />
        <LxInput v-model="dueAt" type="date" label="Срок" :error="error" />
      </div>
      <LxInput :model-value="perDay" type="number" :min="1" label="Новых слов в день" :hint="dosingHint"
        @update:model-value="v => (perDay = typeof v === 'number' ? v : null)" />
    </div>
    <template #footer>
      <LxButton variant="secondary" @click="emit('update:visible', false)">Отмена</LxButton>
      <LxButton :disabled="!canSubmit" :loading="loading" @click="submit">Назначить</LxButton>
    </template>
  </LxModal>
</template>

<style scoped lang="scss">
.checks {
  max-height: 240px;
  overflow-y: auto;
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
}

.dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
</style>
