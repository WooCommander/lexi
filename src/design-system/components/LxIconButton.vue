<script setup lang="ts">
interface Props {
  label: string
  variant?: 'ghost' | 'surface' | 'primary' | 'danger'
  active?: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), { variant: 'ghost', active: false, disabled: false })
const emit = defineEmits<{ (e: 'click', event: MouseEvent): void }>()
</script>

<template>
  <button type="button" class="lx-icon-btn" :class="[`lx-icon-btn--${variant}`, { 'is-active': active }]"
    :aria-label="label" :title="label" :disabled="disabled" @click="emit('click', $event)">
    <slot />
  </button>
</template>

<style scoped lang="scss">
.lx-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--tap-size);
  height: var(--tap-size);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.08s;

  &--ghost:hover:not(:disabled) {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  &--surface {
    background: var(--color-surface);
    border-color: var(--color-border);
  }

  &--primary {
    background: var(--color-primary);
    color: var(--color-on-primary);
  }

  &--danger:hover:not(:disabled) {
    background: var(--color-error-soft);
    color: var(--color-error);
  }

  &.is-active {
    color: var(--color-warning);
  }

  &:active:not(:disabled) {
    transform: scale(0.92);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}
</style>
