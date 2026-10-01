<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ClipboardList, ListPlus, Pencil, Plus, Search, Star, Trash2 } from 'lucide-vue-next'
import {
  LxBadge,
  LxButton,
  LxCard,
  LxConfirmationModal,
  LxEmptyState,
  LxIconButton,
  LxInput,
  LxModal,
  LxPageHeader,
  LxSpinner,
  LxTextarea,
} from '@/design-system'
import WordFormModal from './components/WordFormModal.vue'
import BulkAddModal from './components/BulkAddModal.vue'
import { WordSetService } from '../services/WordSetService'
import { useWordSetsStore } from '../state/useWordSetsStore'
import { WORD_SOURCE_LABELS, type WordSet, type WordSetEntry } from '../domain/WordSet'
import { VocabularyService } from '@/modules/vocabulary/services/VocabularyService'
import type { VocabularyItem, VocabularyItemInput } from '@/modules/vocabulary/domain/VocabularyItem'
import { useLanguagePair } from '@/modules/languages/composables/useLanguagePair'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { UserRole } from '@/modules/auth/domain/User'
import { useStudyStore } from '@/modules/training/state/useStudyStore'
import { STATUS_LABELS, WordLearningStatus } from '@/modules/training/domain/Training'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'
import { wordsLabel } from '@/shared/lib/plural'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sets = useWordSetsStore()
const study = useStudyStore()
const { notify } = useNotify()

const setId = computed(() => String(route.params.id))
const set = ref<WordSet | null>(null)
const entries = ref<WordSetEntry[]>([])
const isLoading = ref(true)
const query = ref('')

const isOwner = computed(() => !!set.value && set.value.ownerId === auth.userId)
const isStudent = computed(() => auth.activeRole === UserRole.Student)
const canAssign = computed(() => isOwner.value && auth.activeRole !== UserRole.Student)
const pair = useLanguagePair(set)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(e => e.item.sourceText.toLowerCase().includes(q) || e.item.targetText.toLowerCase().includes(q))
})

const statusTone = (status: WordLearningStatus) =>
  status === WordLearningStatus.Learned ? 'success' : status === WordLearningStatus.Learning ? 'primary' : 'neutral'

const load = async () => {
  isLoading.value = true
  try {
    set.value = await WordSetService.fetch(setId.value)
    entries.value = set.value ? await WordSetService.fetchEntries([setId.value]) : []
    if (isStudent.value) await study.load()
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить набор'), 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

const syncCount = () => {
  if (set.value) sets.setItemCount(set.value.id, entries.value.length)
  if (isStudent.value) study.load(true)
}

// --- Добавление / редактирование ---
const isWordOpen = ref(false)
const isBulkOpen = ref(false)
const editing = ref<VocabularyItem | null>(null)
const isSaving = ref(false)

const openAdd = () => {
  editing.value = null
  isWordOpen.value = true
}

const openEdit = (item: VocabularyItem) => {
  editing.value = item
  isWordOpen.value = true
}

const nextPosition = () => entries.value.reduce((max, e) => Math.max(max, e.position + 1), 0)

const saveWord = async (input: VocabularyItemInput) => {
  if (!set.value) return
  isSaving.value = true
  try {
    if (editing.value) {
      const updated = await VocabularyService.update(editing.value.id, set.value, input)
      entries.value = entries.value.map(e => (e.item.id === updated.id ? { ...e, item: updated } : e))
    } else {
      entries.value = [...entries.value, ...(await WordSetService.addWords(set.value, [input], nextPosition()))]
    }
    isWordOpen.value = false
    syncCount()
  } catch (e) {
    notify(errorMessage(e, 'Не удалось сохранить слово'), 'error')
  } finally {
    isSaving.value = false
  }
}

const saveBulk = async (inputs: VocabularyItemInput[]) => {
  if (!set.value) return
  isSaving.value = true
  try {
    const added = await WordSetService.addWords(set.value, inputs, nextPosition())
    entries.value = [...entries.value, ...added]
    isBulkOpen.value = false
    notify(`Добавлено: ${wordsLabel(added.length)}`, 'success')
    syncCount()
  } catch (e) {
    notify(errorMessage(e, 'Не удалось добавить слова'), 'error')
  } finally {
    isSaving.value = false
  }
}

// --- Удаление ---
const pendingDelete = ref<VocabularyItem | null>(null)
const isDeleteSetOpen = ref(false)

const deleteWord = async () => {
  const item = pendingDelete.value
  if (!item || !set.value) return
  try {
    // своё слово удаляем целиком, чужое (переиспользованное) — только убираем из набора
    if (item.createdBy === auth.userId) await VocabularyService.remove(item.id)
    else await WordSetService.unlink(set.value.id, item.id)
    entries.value = entries.value.filter(e => e.item.id !== item.id)
    syncCount()
  } catch (e) {
    notify(errorMessage(e, 'Не удалось удалить слово'), 'error')
  }
}

const deleteSet = async () => {
  if (!set.value) return
  try {
    await sets.remove(set.value.id)
    notify('Набор удалён', 'success')
    router.replace('/sets')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось удалить набор'), 'error')
  }
}

// --- Редактирование набора ---
const isEditSetOpen = ref(false)
const editName = ref('')
const editDescription = ref('')

const openEditSet = () => {
  editName.value = set.value?.name ?? ''
  editDescription.value = set.value?.description ?? ''
  isEditSetOpen.value = true
}

const saveSet = async () => {
  if (!set.value || !editName.value.trim()) return
  try {
    await sets.update(set.value.id, { name: editName.value, description: editDescription.value })
    set.value = { ...set.value, name: editName.value.trim(), description: editDescription.value.trim() || undefined }
    isEditSetOpen.value = false
  } catch (e) {
    notify(errorMessage(e, 'Не удалось сохранить'), 'error')
  }
}

const toggleFavorite = async (itemId: string) => {
  try {
    await study.toggleFavorite(itemId)
  } catch {
    notify('Не удалось обновить избранное', 'error')
  }
}
</script>

<template>
  <div class="page">
    <div v-if="isLoading" class="center"><LxSpinner /></div>

    <LxEmptyState v-else-if="!set" title="Набор не найден" description="Возможно, он удалён или у вас нет доступа.">
      <LxButton @click="router.replace('/sets')">К наборам</LxButton>
    </LxEmptyState>

    <template v-else>
      <LxPageHeader back="/sets" :title="set.name">
        <template #subtitle>
          {{ pair.sourceFlag.value }} {{ pair.label.value }} · {{ wordsLabel(entries.length) }}
          <LxBadge v-if="!isOwner" tone="primary">{{ WORD_SOURCE_LABELS[set.source] }}</LxBadge>
        </template>
        <template v-if="isOwner" #actions>
          <LxIconButton label="Изменить набор" variant="surface" @click="openEditSet"><Pencil :size="20" /></LxIconButton>
          <LxIconButton label="Удалить набор" variant="surface" @click="isDeleteSetOpen = true"><Trash2 :size="20" /></LxIconButton>
        </template>
      </LxPageHeader>

      <p v-if="set.description" class="muted">{{ set.description }}</p>

      <div class="toolbar">
        <div class="toolbar__search">
          <Search :size="20" class="toolbar__icon" />
          <LxInput v-model="query" placeholder="Поиск по словам" />
        </div>
        <template v-if="isOwner">
          <LxButton @click="openAdd"><Plus :size="20" /> Слово</LxButton>
          <LxButton variant="secondary" @click="isBulkOpen = true"><ListPlus :size="20" /> Списком</LxButton>
        </template>
        <LxButton v-if="canAssign" variant="secondary" @click="router.push({ path: '/assignments', query: { set: set.id } })">
          <ClipboardList :size="20" /> Назначить
        </LxButton>
      </div>

      <LxEmptyState v-if="!entries.length" compact title="В наборе нет слов"
        :description="isOwner ? 'Добавьте слова по одному или списком.' : undefined" />

      <LxCard v-else padding="none">
        <ul class="words">
          <li v-for="e in filtered" :key="e.item.id" class="words__row">
            <div class="words__text">
              <span class="words__source" :lang="pair.source.value?.code">{{ e.item.sourceText }}</span>
              <span v-if="e.item.sourceTranscription" class="caption">{{ e.item.sourceTranscription }}</span>
            </div>
            <span class="words__target" :lang="pair.target.value?.code">{{ e.item.targetText }}</span>
            <div class="words__actions">
              <template v-if="isStudent">
                <LxBadge :tone="statusTone(study.progress.get(e.item.id)?.status ?? WordLearningStatus.New)">
                  {{ STATUS_LABELS[study.progress.get(e.item.id)?.status ?? WordLearningStatus.New] }}
                </LxBadge>
                <LxIconButton :label="study.favorites.has(e.item.id) ? 'Убрать из избранного' : 'В избранное'"
                  :active="study.favorites.has(e.item.id)" @click="toggleFavorite(e.item.id)">
                  <Star :size="20" :fill="study.favorites.has(e.item.id) ? 'currentColor' : 'none'" />
                </LxIconButton>
              </template>
              <template v-if="isOwner">
                <LxIconButton label="Изменить" @click="openEdit(e.item)"><Pencil :size="18" /></LxIconButton>
                <LxIconButton label="Удалить" variant="danger" @click="pendingDelete = e.item"><Trash2 :size="18" /></LxIconButton>
              </template>
            </div>
          </li>
        </ul>
      </LxCard>

      <WordFormModal v-model:visible="isWordOpen" :pair="set" :item="editing" :loading="isSaving" @submit="saveWord" />
      <BulkAddModal v-model:visible="isBulkOpen" :pair="set" :loading="isSaving" @submit="saveBulk" />

      <LxConfirmationModal :visible="!!pendingDelete" title="Удалить слово?"
        :message="`«${pendingDelete?.sourceText}» будет удалено вместе со статистикой учеников по нему.`"
        confirm-text="Удалить" variant="danger" @update:visible="v => !v && (pendingDelete = null)" @confirm="deleteWord" />

      <LxConfirmationModal v-model:visible="isDeleteSetOpen" title="Удалить набор?"
        message="Набор и связанные с ним задания будут удалены. Слова останутся в других наборах."
        confirm-text="Удалить" variant="danger" @confirm="deleteSet" />

      <LxModal v-model:visible="isEditSetOpen" title="Изменить набор">
        <div class="stack">
          <LxInput v-model="editName" label="Название" />
          <LxTextarea v-model="editDescription" label="Описание" :rows="3" />
          <p class="caption">Языковую пару изменить нельзя — слова уже привязаны к ней.</p>
        </div>
        <template #footer>
          <LxButton variant="secondary" @click="isEditSetOpen = false">Отмена</LxButton>
          <LxButton :disabled="!editName.trim()" @click="saveSet">Сохранить</LxButton>
        </template>
      </LxModal>
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

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;

  &__search {
    position: relative;
    flex: 1;
    min-width: 220px;

    :deep(.lx-field__input) {
      padding-left: 44px;
    }
  }

  &__icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-tertiary);
    z-index: 1;
  }
}

.words {
  list-style: none;
  margin: 0;
  padding: 0;

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-5);

    & + & {
      border-top: 2px solid var(--color-border);
    }

    @media (max-width: 560px) {
      grid-template-columns: 1fr auto;

      .words__target {
        grid-column: 1;
        grid-row: 2;
      }

      .words__actions {
        grid-row: 1 / span 2;
        grid-column: 2;
      }
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
  }

  &__source {
    font-size: var(--text-h3);
    font-weight: 800;
  }

  &__target {
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}
</style>
