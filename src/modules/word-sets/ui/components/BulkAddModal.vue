<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LxBadge, LxButton, LxModal, LxTextarea } from '@/design-system'
import { parseBulkWords } from '@/modules/vocabulary/lib/bulkParse'
import type { VocabularyItemInput } from '@/modules/vocabulary/domain/VocabularyItem'
import type { LanguagePair } from '@/modules/languages/domain/Language'
import { useLanguagePair } from '@/modules/languages/composables/useLanguagePair'
import { wordsLabel } from '@/shared/lib/plural'

const props = defineProps<{ visible: boolean; pair: LanguagePair; loading?: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'submit', items: VocabularyItemInput[]): void }>()

const { label } = useLanguagePair(() => props.pair)
const text = ref('')

watch(
  () => props.visible,
  v => {
    if (v) text.value = ''
  },
)

const parsed = computed(() => parseBulkWords(text.value))
</script>

<template>
  <LxModal :visible="visible" title="Добавить списком" size="lg" @update:visible="emit('update:visible', $event)">
    <div class="stack">
      <p class="muted">
        Пара: <b>{{ label }}</b>. По одному слову в строке, через «-», «;» или табуляцию.
        Третьей колонкой через «;» можно указать транскрипцию.
      </p>
      <LxTextarea v-model="text" :rows="10" placeholder="apple - яблоко&#10;dog;собака&#10;cat;кошка;/kæt/" />

      <div class="summary">
        <LxBadge tone="success">Распознано: {{ parsed.items.length }}</LxBadge>
        <LxBadge v-if="parsed.duplicates" tone="warning">Повторов: {{ parsed.duplicates }}</LxBadge>
        <LxBadge v-if="parsed.errors.length" tone="error">Ошибок: {{ parsed.errors.length }}</LxBadge>
      </div>

      <ul v-if="parsed.errors.length" class="errors">
        <li v-for="e in parsed.errors.slice(0, 5)" :key="e.line">Строка {{ e.line }}: «{{ e.text }}»</li>
      </ul>

      <div v-if="parsed.items.length" class="preview">
        <div v-for="(i, idx) in parsed.items.slice(0, 8)" :key="idx" class="preview__row">
          <b>{{ i.sourceText }}</b><span class="muted">{{ i.targetText }}</span>
        </div>
        <div v-if="parsed.items.length > 8" class="caption">…и ещё {{ parsed.items.length - 8 }}</div>
      </div>
    </div>
    <template #footer>
      <LxButton variant="secondary" @click="emit('update:visible', false)">Отмена</LxButton>
      <LxButton :disabled="!parsed.items.length" :loading="loading" @click="emit('submit', parsed.items)">
        Добавить {{ wordsLabel(parsed.items.length) }}
      </LxButton>
    </template>
  </LxModal>
</template>

<style scoped lang="scss">
.summary {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.errors {
  margin: 0;
  padding-left: var(--space-5);
  color: var(--color-error);
  font-size: var(--text-small);
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);

  &__row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }
}
</style>
