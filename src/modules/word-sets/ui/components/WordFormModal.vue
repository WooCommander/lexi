<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { LxButton, LxInput, LxModal } from '@/design-system'
import { useLanguagePair } from '@/modules/languages/composables/useLanguagePair'
import type { LanguagePair } from '@/modules/languages/domain/Language'
import type { VocabularyItem, VocabularyItemInput } from '@/modules/vocabulary/domain/VocabularyItem'

/** Форма зависит от языковой пары: подписи и lang у полей берутся из пары набора. */
const props = defineProps<{ visible: boolean; pair: LanguagePair; item?: VocabularyItem | null; loading?: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'submit', input: VocabularyItemInput): void }>()

const { source, target, sourceLabel, targetLabel, sourceFlag, targetFlag } = useLanguagePair(() => props.pair)

const form = reactive<Required<VocabularyItemInput>>({
  sourceText: '',
  targetText: '',
  sourceTranscription: '',
  targetTranscription: '',
  exampleSource: '',
  exampleTarget: '',
})

watch(
  () => props.visible,
  v => {
    if (!v) return
    const i = props.item
    form.sourceText = i?.sourceText ?? ''
    form.targetText = i?.targetText ?? ''
    form.sourceTranscription = i?.sourceTranscription ?? ''
    form.targetTranscription = i?.targetTranscription ?? ''
    form.exampleSource = i?.exampleSource ?? ''
    form.exampleTarget = i?.exampleTarget ?? ''
  },
)

const canSubmit = computed(() => !!form.sourceText.trim() && !!form.targetText.trim())

const submit = () => {
  if (canSubmit.value) emit('submit', { ...form })
}
</script>

<template>
  <LxModal :visible="visible" :title="item ? 'Изменить слово' : 'Новое слово'" @update:visible="emit('update:visible', $event)">
    <form class="word-form" @submit.prevent="submit">
      <div class="word-form__lang">{{ sourceFlag }} {{ sourceLabel }}</div>
      <LxInput v-model="form.sourceText" label="Слово" :lang="source?.code" placeholder="beautiful" />
      <LxInput v-model="form.sourceTranscription" label="Транскрипция" :lang="source?.code" placeholder="ˈbjuːtɪfəl" />

      <div class="word-form__lang">{{ targetFlag }} {{ targetLabel }}</div>
      <LxInput v-model="form.targetText" label="Перевод" :lang="target?.code" placeholder="красивый" />

      <details class="word-form__more" :open="!!(form.exampleSource || form.targetTranscription)">
        <summary>Пример и дополнительно</summary>
        <div class="stack">
          <LxInput v-model="form.exampleSource" label="Пример" :lang="source?.code" placeholder="It is a beautiful day." />
          <LxInput v-model="form.exampleTarget" label="Перевод примера" :lang="target?.code"
            placeholder="Сегодня прекрасный день." />
          <LxInput v-model="form.targetTranscription" :label="`Транскрипция (${targetLabel})`" :lang="target?.code" />
        </div>
      </details>
      <button type="submit" hidden />
    </form>
    <template #footer>
      <LxButton variant="secondary" @click="emit('update:visible', false)">Отмена</LxButton>
      <LxButton :disabled="!canSubmit" :loading="loading" @click="submit">Сохранить</LxButton>
    </template>
  </LxModal>
</template>

<style scoped lang="scss">
.word-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &__lang {
    margin-top: var(--space-2);
    font-weight: 900;
    font-size: var(--text-h3);
  }

  &__more {
    summary {
      min-height: 44px;
      display: flex;
      align-items: center;
      font-weight: 800;
      color: var(--color-primary);
      cursor: pointer;
    }
  }
}
</style>
