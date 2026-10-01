<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeftRight } from 'lucide-vue-next'
import { LxButton, LxIconButton, LxInput, LxModal, LxSelect, LxTextarea } from '@/design-system'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'

export interface CreateWordSetPayload {
  name: string
  description: string
  sourceLanguageId: string
  targetLanguageId: string
}

const props = defineProps<{ visible: boolean; loading?: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'submit', payload: CreateWordSetPayload): void }>()

const languages = useLanguagesStore()
const settings = useSettingsStore()

const name = ref('')
const description = ref('')
const sourceLanguageId = ref<string | null>(null)
const targetLanguageId = ref<string | null>(null)

watch(
  () => props.visible,
  v => {
    if (!v) return
    name.value = ''
    description.value = ''
    // по умолчанию: English → родной язык
    const native = settings.settings?.nativeLanguageId ?? languages.byCode.get('ru')?.id ?? null
    targetLanguageId.value = native
    sourceLanguageId.value = languages.languages.find(l => l.id !== native)?.id ?? null
  },
)

const error = computed(() => {
  if (sourceLanguageId.value && sourceLanguageId.value === targetLanguageId.value) return 'Языки пары должны различаться'
  return ''
})
const canSubmit = computed(() => !!name.value.trim() && !!sourceLanguageId.value && !!targetLanguageId.value && !error.value)

const swap = () => {
  ;[sourceLanguageId.value, targetLanguageId.value] = [targetLanguageId.value, sourceLanguageId.value]
}

const submit = () => {
  if (!canSubmit.value) return
  emit('submit', {
    name: name.value,
    description: description.value,
    sourceLanguageId: sourceLanguageId.value!,
    targetLanguageId: targetLanguageId.value!,
  })
}
</script>

<template>
  <LxModal :visible="visible" title="Новый набор" @update:visible="emit('update:visible', $event)">
    <form class="stack" @submit.prevent="submit">
      <LxInput v-model="name" label="Название" placeholder="Unit 1 — Family" />
      <div class="pair">
        <LxSelect v-model="sourceLanguageId" :options="languages.options" label="Язык слова" />
        <LxIconButton label="Поменять местами" variant="surface" class="pair__swap" @click="swap">
          <ArrowLeftRight :size="20" />
        </LxIconButton>
        <LxSelect v-model="targetLanguageId" :options="languages.options" label="Язык перевода" />
      </div>
      <p v-if="error" class="lx-field__error">{{ error }}</p>
      <LxTextarea v-model="description" label="Описание (необязательно)" :rows="2" />
    </form>
    <template #footer>
      <LxButton variant="secondary" @click="emit('update:visible', false)">Отмена</LxButton>
      <LxButton :disabled="!canSubmit" :loading="loading" @click="submit">Создать</LxButton>
    </template>
  </LxModal>
</template>

<style scoped lang="scss">
.pair {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: var(--space-2);

  @media (max-width: 480px) {
    grid-template-columns: 1fr;

    &__swap {
      justify-self: center;
      transform: rotate(90deg);
    }
  }
}
</style>
