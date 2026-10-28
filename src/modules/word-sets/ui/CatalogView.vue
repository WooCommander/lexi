<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, ListChecks, Plus } from 'lucide-vue-next'
import { LxBadge, LxButton, LxCard, LxEmptyState, LxPageHeader, LxSegmented, LxSpinner } from '@/design-system'
import PickWordsModal, { type PickWordsPayload } from './components/PickWordsModal.vue'
import { useStarterSets } from '../composables/useStarterSets'
import { useWordSetsStore } from '../state/useWordSetsStore'
import { useAssignmentsStore } from '@/modules/assignments/state/useAssignmentsStore'
import { useStudentsStore } from '@/modules/students/state/useStudentsStore'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { UserRole } from '@/modules/auth/domain/User'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'
import { isLanguageAllowed } from '@/modules/settings/domain/UserSettings'
import { CATALOG_LANGUAGES, STARTER_SETS, type StarterSet } from '@/modules/vocabulary/lib/starterSets'
import { GRADE_LABELS, type GradeBand } from '@/modules/vocabulary/lib/catalog/topics'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'
import { wordsLabel } from '@/shared/lib/plural'

const router = useRouter()
const route = useRoute()
const assignmentsStore = useAssignmentsStore()
const students = useStudentsStore()
const auth = useAuthStore()
const sets = useWordSetsStore()
const languages = useLanguagesStore()
const settings = useSettingsStore()
const { notify } = useNotify()
const { add, addSelected, targetsFor, isAdded, addingId } = useStarterSets()

const isLoading = ref(true)

/** Каталог открыт с экрана ученика: добавленный набор сразу назначается ему. */
const forStudentId = computed(() =>
  auth.activeRole !== UserRole.Student && typeof route.query.student === 'string' ? route.query.student : null,
)
const forStudentName = computed(() => (forStudentId.value ? students.nameOf(forStudentId.value) : ''))
const isTeaching = computed(() => auth.activeRole !== UserRole.Student)

onMounted(async () => {
  try {
    await Promise.all([languages.load(), settings.load()])
    await sets.load()
    if (isTeaching.value) await Promise.all([assignmentsStore.load(), students.load()])
    // первый доступный язык — по умолчанию (изучаемый, если он есть в каталоге)
    languageCode.value = availableLanguages.value[0]?.code ?? ''
  } finally {
    isLoading.value = false
  }
})

/** Ученику родитель мог запретить личные слова — тогда готовые наборы тоже недоступны. */
const canAdd = computed(() => auth.activeRole !== UserRole.Student || settings.settings?.allowPersonalWords !== false)

const availableLanguages = computed(() =>
  CATALOG_LANGUAGES.filter(l => {
    const language = languages.byCode.get(l.code)
    if (!language || !languages.byCode.has('ru')) return false
    // родитель мог ограничить ребёнку список языков
    return auth.activeRole !== UserRole.Student || isLanguageAllowed(settings.settings, language.id)
  }),
)
const languageCode = ref<string>('')
const grade = ref<GradeBand | 'all'>('all')

const languageOptions = computed(() => availableLanguages.value.map(l => ({ value: l.code, label: l.title })))
const gradeOptions = [
  { value: 'all' as const, label: 'Все' },
  { value: '2-3' as const, label: GRADE_LABELS['2-3'] },
  { value: '4-6' as const, label: GRADE_LABELS['4-6'] },
  { value: 'adults' as const, label: GRADE_LABELS.adults },
]


const visible = computed(() =>
  STARTER_SETS.filter(s => s.sourceCode === languageCode.value && (grade.value === 'all' || s.grades === grade.value)),
)

const totalWords = computed(() => visible.value.reduce((n, s) => n + s.words.length, 0))

const setOf = (starter: StarterSet) => sets.sets.find(s => s.name === starter.name)

const isAssigned = (starter: StarterSet) => {
  const set = setOf(starter)
  const id = forStudentId.value
  return !!set && !!id && assignmentsStore.assignments.some(a => a.wordSetId === set.id && a.studentIds.includes(id))
}

const assignTo = async (wordSetId: string) => {
  const studentId = forStudentId.value
  if (!studentId) return
  await assignmentsStore.create({
    wordSetId,
    studentIds: [studentId],
    source: auth.activeRole === UserRole.Parent ? 'parent' : 'teacher',
  })
}

const addOne = async (starter: StarterSet) => {
  try {
    const set = setOf(starter) ?? (await add(starter))
    if (forStudentId.value) {
      await assignTo(set.id)
      notify(`«${starter.topicTitle}» добавлен: ${forStudentName.value}`, 'success')
    } else {
      notify(`Набор «${starter.name}» добавлен`, 'success')
    }
  } catch (e) {
    notify(errorMessage(e, 'Не удалось добавить набор'), 'error')
  }
}

// --- Собрать свой набор из выбранных слов ---
const pickingStarter = ref<StarterSet | null>(null)
const isPickOpen = ref(false)
const isPicking = ref(false)

const openPick = (starter: StarterSet) => {
  pickingStarter.value = starter
  isPickOpen.value = true
}

const submitPick = async (payload: PickWordsPayload) => {
  const starter = pickingStarter.value
  if (!starter) return
  isPicking.value = true
  try {
    const { set, added, skipped } = await addSelected(starter, payload.words, payload)
    isPickOpen.value = false
    notify(
      skipped ? `В набор «${set.name}» добавлено ${added}, повторов пропущено: ${skipped}` : `В набор «${set.name}» добавлено слов: ${added}`,
      'success',
    )
  } catch (e) {
    notify(errorMessage(e, 'Не удалось добавить слова'), 'error')
  } finally {
    isPicking.value = false
  }
}

const open = (starter: StarterSet) => {
  const set = setOf(starter)
  if (set) router.push(`/sets/${set.id}`)
}

/** Набор уже есть в библиотеке учителя/родителя — перейти к назначению. */
const goAssign = (starter: StarterSet) => {
  const set = setOf(starter)
  if (set) router.push({ path: '/assignments', query: { set: set.id } })
}

const sample = (starter: StarterSet) =>
  starter.words
    .slice(0, 4)
    .map(w => w.sourceText)
    .join(' · ')
</script>

<template>
  <div class="page">
    <LxPageHeader :back="forStudentId ? `/students/${forStudentId}` : '/sets'" title="Готовые наборы"
      :subtitle="forStudentName ? `Для: ${forStudentName}. Выбранный набор сразу появится у ученика` : 'Слова по темам — школьникам и взрослым: от первых слов до быта, поездок и работы'" />

    <div v-if="isLoading" class="center"><LxSpinner /></div>

    <LxEmptyState v-else-if="!availableLanguages.length" compact title="Языки ещё не загружены"
      description="Откройте раздел позже или проверьте подключение." />

    <template v-else>
      <div class="filters">
        <LxSegmented v-model="languageCode" :options="languageOptions" label="Язык" />
        <LxSegmented v-model="grade" :options="gradeOptions" label="Уровень" />
      </div>

      <p class="caption">
        {{ visible.length }} тем · {{ wordsLabel(totalWords) }}. Уровни — ориентир, не жёсткая привязка к программе: тему можно взять любую.
      </p>
      <p v-if="!canAdd" class="caption warn">Родитель отключил добавление личных слов.</p>

      <div class="grid-cards">
        <LxCard v-for="s in visible" :key="s.id" class="topic">
          <div class="topic__head">
            <h2 class="topic__title">{{ s.topicTitle }}</h2>
            <LxBadge :tone="s.grades === '2-3' ? 'primary' : s.grades === '4-6' ? 'accent' : 'success'">{{ GRADE_LABELS[s.grades] }}</LxBadge>
          </div>
          <p class="topic__sample" :lang="s.sourceCode">{{ sample(s) }}…</p>
          <div class="topic__foot">
            <span class="caption">{{ wordsLabel(s.words.length) }}</span>
            <template v-if="forStudentId">
              <LxButton v-if="isAssigned(s)" variant="secondary" size="sm" @click="open(s)">
                <Check :size="18" /> Назначено
              </LxButton>
              <LxButton v-else size="sm" :disabled="!!addingId" :loading="addingId === s.id" @click="addOne(s)">
                <Plus :size="18" /> {{ isAdded(s) ? 'Назначить' : 'Добавить' }}
              </LxButton>
            </template>
            <template v-else>
              <LxButton variant="ghost" size="sm" :disabled="!canAdd" @click="openPick(s)">
                <ListChecks :size="18" /> Выбрать слова
              </LxButton>
              <LxButton v-if="isAdded(s)" variant="secondary" size="sm" @click="open(s)">
                <Check :size="18" /> Добавлено
              </LxButton>
              <LxButton v-else size="sm" :disabled="!canAdd || !!addingId" :loading="addingId === s.id" @click="addOne(s)">
                <Plus :size="18" /> Добавить
              </LxButton>
              <LxButton v-if="isTeaching && isAdded(s)" size="sm" @click="goAssign(s)">Назначить</LxButton>
            </template>
          </div>
        </LxCard>
      </div>
    </template>

    <PickWordsModal v-model:visible="isPickOpen" :starter="pickingStarter" :targets="pickingStarter ? targetsFor(pickingStarter) : []"
      :loading="isPicking" @submit="submitPick" />
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
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.warn {
  color: var(--color-warning);
}

.topic {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    // место под название в две строки — карточки в ряду одной высоты
    min-height: 3rem;
  }

  &__title {
    margin: 0;
    font-size: var(--text-h3);
    font-weight: 900;
    line-height: 1.2;
  }

  &__sample {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-small);
    // не больше двух строк
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__foot {
    margin-top: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
}
</style>
