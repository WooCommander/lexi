<script setup lang="ts">
import { useId } from 'vue'

interface Props {
  modelValue: string | number | null | undefined
  label?: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date'
  hint?: string
  error?: string
  disabled?: boolean
  autocomplete?: string
  lang?: string
  min?: number
  max?: number
}

const props = withDefaults(defineProps<Props>(), { type: 'text', disabled: false })
const emit = defineEmits<{ (e: 'update:modelValue', value: string | number | null): void }>()
const id = useId()

const onInput = (e: Event) => {
  const raw = (e.target as HTMLInputElement).value
  if (props.type === 'number') emit('update:modelValue', raw === '' ? null : Number(raw))
  else emit('update:modelValue', raw)
}
</script>

<template>
  <div class="lx-field" :class="{ 'has-error': !!error }">
    <label v-if="label" :for="id" class="lx-field__label">{{ label }}</label>
    <input :id="id" class="lx-field__input" :type="type" :value="modelValue ?? ''" :placeholder="placeholder"
      :disabled="disabled" :autocomplete="autocomplete" :lang="lang" :min="min" :max="max" @input="onInput" />
    <span v-if="error" class="lx-field__error">{{ error }}</span>
    <span v-else-if="hint" class="lx-field__hint">{{ hint }}</span>
  </div>
</template>

<style lang="scss">
// Общие стили полей — используются LxInput, LxTextarea, LxSelect
.lx-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  &__label {
    font-size: var(--text-small);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  &__input {
    width: 100%;
    min-height: var(--tap-size);
    padding: 10px 14px;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: var(--text-body);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;

    &::placeholder {
      color: var(--color-text-tertiary);
    }

    &:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px var(--color-primary-soft);
    }

    &:disabled {
      opacity: 0.6;
    }
  }

  &.has-error &__input {
    border-color: var(--color-error);
  }

  &__error {
    font-size: var(--text-caption);
    color: var(--color-error);
  }

  &__hint {
    font-size: var(--text-caption);
    color: var(--color-text-tertiary);
  }
}
</style>
