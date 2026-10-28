<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LxButton, LxCheckbox, LxInput, LxModal, LxSegmented, LxSelect } from '@/design-system'
import type { StarterSet } from '@/modules/vocabulary/lib/starterSets'
import type { VocabularyItemInput } from '@/modules/vocabulary/domain/VocabularyItem'
import type { WordSet } from '../../domain/WordSet'
import { wordsLabel } from '@/shared/lib/plural'

export interface PickWordsPayload {
  words: VocabularyItemInput[]
  /** Существующий набор, куда добавить; null — создать новый с названием `name`. */
  setId: string | null
  name: string
}

/** «Собрать свой набор»: отметить нужные слова из готовой темы и положить в новый или свой существующий набор. */
const props = defineProps<{ visible: boolean; starter: StarterSet | null; targets: WordSet[]; loading?: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'submit', payload: PickWordsPayload): void }>()

type Mode = 'new' | 'existing'

const selected = ref<Set<number>>(new Set())
const mode = ref<Mode>('new')
const name = ref('')
const targetId = ref<string | null>(null)

watch(
  () => [props.visible, props.starter] as const,
  ([visible]) => {
    if (!visible || !props.starter) return
    selected.value = new Set()
    mode.value = 'new'
    name.value = 'Мои слова'
    targetId.value = props.targets[0]?.id ?? null
  },
)

const words = computed(() => props.starter?.words ?? [])
const picked = computed(() => words.value.filter((_, i) => selected.value.has(i)))
const allSelected = computed(() => words.value.length > 0 && selected.value.size === words.value.length)

const toggle = (index: number, on: boolean) => {
  const next = new Set(selected.value)
  if (on) next.add(index)
  else next.delete(index)
  selected.value = next
}
const toggleAll = () => {
  selected.value = allSelected.value ? new Set() : new Set(words.value.map((_, i) => i))
}

const modeOptions = computed(() => [
  { value: 'new' as Mode, label: 'Новый набор' },
  ...(props.targets.length ? [{ value: 'existing' as Mode, label: 'В мой набор' }] : []),
])
const targetOptions = computed(() => props.targets.map(s => ({ value: s.id, label: `${s.name} (${wordsLabel(s.itemCount)})` })))

const canSubmit = computed(
  () => picked.value.length > 0 && (mode.value === 'new' ? !!name.value.trim() : !!targetId.value),
)

const submit = () => {
  if (!canSubmit.value) return
  emit('submit', {
    words: picked.value,
    setId: mode.value === 'existing' ? targetId.value : null,
    name: name.value.trim(),
  })
}
</script>

<template>
  <LxModal :visible="visible" :title="starter ? `Выбрать слова: ${starter.topicTitle}` : 'Выбрать слова'" size="lg"
    @update:visible="emit('update:visible', $event)">
    <div v-if="starter" class="stack">
      <div class="head">
        <LxCheckbox :model-value="allSelected" @update:model-value="toggleAll">Выбрать все</LxCheckbox>
        <span class="caption">Выбрано: {{ picked.length }} из {{ words.length }}</span>
      </div>

      <ul class="words">
        <li v-for="(w, i) in words" :key="i">
          <LxCheckbox :model-value="selected.has(i)" @update:model-value="v => toggle(i, v)">
            <span class="w-source" :lang="starter.sourceCode">{{ w.sourceText }}</span>
            <span v-if="w.sourceReading" class="muted"> «{{ w.sourceReading }}»</span>
            <span class="muted"> — {{ w.targetText }}</span>
          </LxCheckbox>
        </li>
      </ul>

      <LxSegmented v-model="mode" :options="modeOptions" label="Куда добавить" />
      <LxInput v-if="mode === 'new'" v-model="name" label="Название нового набора" />
      <LxSelect v-else v-model="targetId" :options="targetOptions" label="Мой набор" />
      <p v-if="mode === 'existing'" class="caption">Слова, которые уже есть в наборе, повторно не добавятся.</p>
    </div>
    <template #footer>
      <LxButton variant="secondary" @click="emit('update:visible', false)">Отмена</LxButton>
      <LxButton :disabled="!canSubmit" :loading="loading" @click="submit">
        Добавить {{ wordsLabel(picked.length) }}
      </LxButton>
    </template>
  </LxModal>
</template>

<style scoped lang="scss">
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.words {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  max-height: 46dvh;
  overflow-y: auto;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;

  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
}

.w-source {
  font-weight: 800;
}
</style>
