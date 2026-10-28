<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Plus } from 'lucide-vue-next'
import { LxBadge, LxButton, LxCard, LxEmptyState, LxPageHeader, LxSegmented, LxSpinner } from '@/design-system'
import { useStarterSets } from '../composables/useStarterSets'
import { useWordSetsStore } from '../state/useWordSetsStore'
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
const auth = useAuthStore()
const sets = useWordSetsStore()
const languages = useLanguagesStore()
const settings = useSettingsStore()
const { notify } = useNotify()
const { add, isAdded, addingId } = useStarterSets()

const isLoading = ref(true)

onMounted(async () => {
  try {
    await Promise.all([languages.load(), settings.load()])
    await sets.load()
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
]


const visible = computed(() =>
  STARTER_SETS.filter(s => s.sourceCode === languageCode.value && (grade.value === 'all' || s.grades === grade.value)),
)

const totalWords = computed(() => visible.value.reduce((n, s) => n + s.words.length, 0))

const addOne = async (starter: StarterSet) => {
  try {
    await add(starter)
    notify(`Набор «${starter.name}» добавлен`, 'success')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось добавить набор'), 'error')
  }
}

const open = (starter: StarterSet) => {
  const set = sets.sets.find(s => s.name === starter.name)
  if (set) router.push(`/sets/${set.id}`)
}

const sample = (starter: StarterSet) =>
  starter.words
    .slice(0, 4)
    .map(w => w.sourceText)
    .join(' · ')
</script>

<template>
  <div class="page">
    <LxPageHeader back="/sets" title="Готовые наборы"
      subtitle="Слова по темам для школьников: от первых слов до простых текстов" />

    <div v-if="isLoading" class="center"><LxSpinner /></div>

    <LxEmptyState v-else-if="!availableLanguages.length" compact title="Языки ещё не загружены"
      description="Откройте раздел позже или проверьте подключение." />

    <template v-else>
      <div class="filters">
        <LxSegmented v-model="languageCode" :options="languageOptions" label="Язык" />
        <LxSegmented v-model="grade" :options="gradeOptions" label="Класс" />
      </div>

      <p class="caption">
        {{ visible.length }} тем · {{ wordsLabel(totalWords) }}. Классы — ориентир по сложности, не жёсткая привязка к программе.
      </p>
      <p v-if="!canAdd" class="caption warn">Родитель отключил добавление личных слов.</p>

      <div class="grid-cards">
        <LxCard v-for="s in visible" :key="s.id" class="topic">
          <div class="topic__head">
            <h2 class="topic__title">{{ s.topicTitle }}</h2>
            <LxBadge :tone="s.grades === '2-3' ? 'primary' : 'accent'">{{ GRADE_LABELS[s.grades] }}</LxBadge>
          </div>
          <p class="topic__sample" :lang="s.sourceCode">{{ sample(s) }}…</p>
          <div class="topic__foot">
            <span class="caption">{{ wordsLabel(s.words.length) }}</span>
            <LxButton v-if="isAdded(s)" variant="secondary" size="sm" @click="open(s)">
              <Check :size="18" /> Добавлено
            </LxButton>
            <LxButton v-else size="sm" :disabled="!canAdd || !!addingId" :loading="addingId === s.id" @click="addOne(s)">
              <Plus :size="18" /> Добавить
            </LxButton>
          </div>
        </LxCard>
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
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
}
</style>
