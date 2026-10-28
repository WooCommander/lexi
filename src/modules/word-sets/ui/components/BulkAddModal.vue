<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileSpreadsheet, X } from 'lucide-vue-next'
import { LxBadge, LxButton, LxModal, LxTextarea } from '@/design-system'
import { parseBulkWords, type BulkParseResult } from '@/modules/vocabulary/lib/bulkParse'
import { MAX_IMPORT_ROWS, parseCsv, parseXlsx, tableToWords } from '@/modules/vocabulary/lib/tableImport'
import type { VocabularyItemInput } from '@/modules/vocabulary/domain/VocabularyItem'
import type { LanguagePair } from '@/modules/languages/domain/Language'
import { useLanguagePair } from '@/modules/languages/composables/useLanguagePair'
import { wordsLabel } from '@/shared/lib/plural'

const props = defineProps<{ visible: boolean; pair: LanguagePair; loading?: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'submit', items: VocabularyItemInput[]): void }>()

const { label } = useLanguagePair(() => props.pair)
const text = ref('')
/** Результат разбора загруженного файла; пока он есть — он важнее текстового поля. */
const imported = ref<{ name: string; result: BulkParseResult } | null>(null)
const fileError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const MAX_FILE_BYTES = 5 * 1024 * 1024

const reset = () => {
  text.value = ''
  imported.value = null
  fileError.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

watch(
  () => props.visible,
  v => {
    if (v) reset()
  },
)

// ручной ввод отменяет загруженный файл
watch(text, () => {
  if (text.value) imported.value = null
})

const parsed = computed(() => imported.value?.result ?? parseBulkWords(text.value))

const onFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  // сбрасываем выбор: иначе повторный выбор того же (исправленного) файла не вызовет change
  input.value = ''
  fileError.value = ''
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('Файл больше 5 МБ — разбейте его на части.')
    const name = file.name.toLowerCase()
    if (name.endsWith('.xlsx')) {
      const table = parseXlsx(new Uint8Array(await file.arrayBuffer()))
      imported.value = { name: file.name, result: tableToWords(table) }
    } else if (name.endsWith('.csv') || name.endsWith('.tsv')) {
      imported.value = { name: file.name, result: tableToWords(parseCsv(await file.text())) }
    } else {
      // .txt и прочее — обычный текст «слово - перевод»: кладём в поле, где его можно поправить
      text.value = await file.text()
      imported.value = null
    }
    if (imported.value && !imported.value.result.items.length && !imported.value.result.errors.length) {
      throw new Error('В файле не найдено ни одной строки.')
    }
  } catch (e) {
    imported.value = null
    fileError.value = e instanceof Error ? e.message : 'Не удалось прочитать файл'
  }
}
</script>

<template>
  <LxModal :visible="visible" title="Добавить списком" size="lg" @update:visible="emit('update:visible', $event)">
    <div class="stack">
      <p class="muted">
        Пара: <b>{{ label }}</b>. По одному слову в строке, через «-», «;» или табуляцию.
        Через «;» третьей колонкой можно указать транскрипцию, четвёртой — как читается русскими буквами.
      </p>
      <div class="file">
        <input ref="fileInput" type="file" class="file__input" accept=".csv,.tsv,.txt,.xlsx" @change="onFile" />
        <LxButton variant="secondary" size="sm" @click="fileInput?.click()">
          <FileSpreadsheet :size="18" /> Загрузить CSV / Excel
        </LxButton>
        <span v-if="imported" class="file__name">
          {{ imported.name }}
          <button type="button" class="file__clear" aria-label="Убрать файл" @click="reset"><X :size="16" /></button>
        </span>
        <span v-else class="caption">колонки: слово, перевод, транскрипция, как читается, пример, перевод примера</span>
      </div>
      <p v-if="fileError" class="file__error" role="alert">{{ fileError }}</p>

      <LxTextarea v-if="!imported" v-model="text" :rows="10" placeholder="apple - яблоко&#10;dog;собака&#10;cat;кошка;/kæt/" />

      <div class="summary">
        <LxBadge tone="success">Распознано: {{ parsed.items.length }}</LxBadge>
        <LxBadge v-if="parsed.duplicates" tone="warning">Повторов: {{ parsed.duplicates }}</LxBadge>
        <LxBadge v-if="parsed.errors.length" tone="error">Ошибок: {{ parsed.errors.length }}</LxBadge>
      </div>

      <ul v-if="parsed.errors.length" class="errors">
        <li v-for="e in parsed.errors.slice(0, 5)" :key="e.line">Строка {{ e.line }}: «{{ e.text }}»</li>
      </ul>
      <p v-if="parsed.truncated" class="caption">
        Загружены только первые {{ MAX_IMPORT_ROWS }} строк.
      </p>

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
.file {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;

  &__input {
    display: none;
  }

  &__name {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 700;
    word-break: break-all;
  }

  &__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--color-surface-2);
    color: inherit;
    cursor: pointer;
  }

  &__error {
    margin: 0;
    color: var(--color-error);
    font-size: var(--text-small);
  }
}

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
