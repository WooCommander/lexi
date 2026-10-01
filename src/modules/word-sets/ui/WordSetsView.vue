<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Library, Plus } from 'lucide-vue-next'
import { LxButton, LxEmptyState, LxPageHeader, LxSpinner } from '@/design-system'
import WordSetCard from './components/WordSetCard.vue'
import CreateWordSetModal, { type CreateWordSetPayload } from './components/CreateWordSetModal.vue'
import { useWordSetsStore } from '../state/useWordSetsStore'
import { WordSource, type WordSet } from '../domain/WordSet'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { UserRole } from '@/modules/auth/domain/User'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { studiedLanguageId } from '@/modules/languages/domain/Language'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'
import { useStudyStore } from '@/modules/training/state/useStudyStore'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const router = useRouter()
const auth = useAuthStore()
const store = useWordSetsStore()
const languages = useLanguagesStore()
const settings = useSettingsStore()
const study = useStudyStore()
const { notify } = useNotify()

const isStudent = computed(() => auth.activeRole === UserRole.Student)
const canCreate = computed(() => !isStudent.value || settings.settings?.allowPersonalWords !== false)
const isCreateOpen = ref(false)
const isCreating = ref(false)

const sourceForRole = computed(() =>
  auth.activeRole === UserRole.Teacher ? WordSource.Teacher : auth.activeRole === UserRole.Parent ? WordSource.Parent : WordSource.Personal,
)

/** Библиотека сгруппирована по изучаемому языку (раздел 29 ТЗ). */
const groupByLanguage = (sets: readonly WordSet[]) => {
  const native = settings.settings?.nativeLanguageId
  const groups = new Map<string, WordSet[]>()
  for (const set of sets) {
    const id = studiedLanguageId(set, native)
    groups.set(id, [...(groups.get(id) ?? []), set])
  }
  return [...groups.entries()]
    .map(([languageId, list]) => ({ languageId, sets: list }))
    .sort((a, b) => languages.label(a.languageId).localeCompare(languages.label(b.languageId)))
}

const ownGroups = computed(() => groupByLanguage(store.sets))
const assignedSets = computed(() => (isStudent.value ? study.material?.assignedSets ?? [] : []))

onMounted(async () => {
  await Promise.all([languages.load(), settings.load()])
  await store.load()
  if (isStudent.value) await study.load()
})

const create = async (payload: CreateWordSetPayload) => {
  isCreating.value = true
  try {
    const set = await store.create({ ...payload, source: sourceForRole.value })
    isCreateOpen.value = false
    router.push(`/sets/${set.id}`)
  } catch (e) {
    notify(errorMessage(e, 'Не удалось создать набор'), 'error')
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="page">
    <LxPageHeader :title="isStudent ? 'Мои наборы' : 'Наборы слов'"
      :subtitle="isStudent ? 'Личные слова и наборы от учителя' : 'Ваша библиотека — её можно назначать снова и снова'">
      <template #actions>
        <LxButton v-if="canCreate" @click="isCreateOpen = true"><Plus :size="20" /> Новый набор</LxButton>
      </template>
    </LxPageHeader>

    <div v-if="store.isLoading && !store.sets.length" class="center"><LxSpinner /></div>

    <template v-else>
      <section v-if="assignedSets.length" class="section">
        <h2 class="section-title">Назначенные</h2>
        <div class="grid-cards">
          <WordSetCard v-for="s in assignedSets" :key="s.id" :set="s" show-source @open="router.push(`/sets/${s.id}`)" />
        </div>
      </section>

      <section v-for="g in ownGroups" :key="g.languageId" class="section">
        <h2 class="section-title">
          <span>{{ languages.flag(g.languageId) }} {{ languages.label(g.languageId) }}</span>
        </h2>
        <div class="grid-cards">
          <WordSetCard v-for="s in g.sets" :key="s.id" :set="s" @open="router.push(`/sets/${s.id}`)" />
        </div>
      </section>

      <LxEmptyState v-if="!ownGroups.length && !assignedSets.length" title="Наборов пока нет"
        :description="canCreate ? 'Создайте первый набор и добавьте в него слова.' : 'Наборы появятся, когда учитель их назначит.'">
        <template #icon><Library :size="36" /></template>
        <LxButton v-if="canCreate" @click="isCreateOpen = true"><Plus :size="20" /> Создать набор</LxButton>
      </LxEmptyState>
    </template>

    <CreateWordSetModal v-model:visible="isCreateOpen" :loading="isCreating" @submit="create" />
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}
</style>
