<script setup lang="ts">
import { Check } from 'lucide-vue-next'

defineProps<{ modelValue: boolean; label?: string; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()
</script>

<template>
  <label class="lx-checkbox" :class="{ checked: modelValue, disabled }">
    <input type="checkbox" :checked="modelValue" :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)" />
    <span class="lx-checkbox__box">
      <Check v-if="modelValue" :size="16" :stroke-width="3.5" />
    </span>
    <span v-if="label || $slots.default" class="lx-checkbox__label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<style scoped lang="scss">
.lx-checkbox {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  cursor: pointer;

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  &__box {
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    border: 2px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-on-primary);
    transition: background 0.15s, border-color 0.15s;
  }

  &.checked &__box {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }

  input:focus-visible + &__box {
    box-shadow: 0 0 0 4px var(--color-primary-soft);
  }

  &.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &__label {
    font-weight: 600;
  }
}
</style>
