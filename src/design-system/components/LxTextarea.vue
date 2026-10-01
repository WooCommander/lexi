<script setup lang="ts">
import { useId } from 'vue'

interface Props {
  modelValue: string | null | undefined
  label?: string
  placeholder?: string
  rows?: number
  hint?: string
  error?: string
}

withDefaults(defineProps<Props>(), { rows: 4 })
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
const id = useId()
</script>

<template>
  <div class="lx-field" :class="{ 'has-error': !!error }">
    <label v-if="label" :for="id" class="lx-field__label">{{ label }}</label>
    <textarea :id="id" class="lx-field__input lx-textarea" :rows="rows" :value="modelValue ?? ''"
      :placeholder="placeholder" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" />
    <span v-if="error" class="lx-field__error">{{ error }}</span>
    <span v-else-if="hint" class="lx-field__hint">{{ hint }}</span>
  </div>
</template>

<style scoped lang="scss">
.lx-textarea {
  resize: vertical;
  line-height: 1.5;
}
</style>
