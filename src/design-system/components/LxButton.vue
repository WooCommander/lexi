<script setup lang="ts">
import { computed } from 'vue'
import LxSpinner from './LxSpinner.vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  block: false,
  disabled: false,
  loading: false,
  type: 'button',
})

const emit = defineEmits<{ (e: 'click', event: MouseEvent): void }>()

const classes = computed(() => [
  'lx-button',
  `lx-button--${props.variant}`,
  `lx-button--${props.size}`,
  { 'lx-button--block': props.block, 'is-loading': props.loading },
])
</script>

<template>
  <button :class="classes" :type="type" :disabled="disabled || loading" @click="emit('click', $event)">
    <LxSpinner v-if="loading" :size="18" class="lx-button__spinner" />
    <span class="lx-button__content">
      <slot />
    </span>
  </button>
</template>

<style scoped lang="scss">
.lx-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  font-weight: 800;
  cursor: pointer;
  user-select: none;
  transition: transform 0.08s ease, filter 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;

  &__content {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  &.is-loading &__content {
    visibility: hidden;
  }

  &__spinner {
    position: absolute;
  }

  &--sm {
    min-height: 44px;
    padding: 0 14px;
    font-size: var(--text-small);
  }

  &--md {
    min-height: var(--tap-size);
    padding: 0 20px;
    font-size: var(--text-body);
  }

  &--lg {
    min-height: 60px;
    padding: 0 28px;
    font-size: 1.1875rem;
    border-radius: var(--radius-lg);
  }

  &--block {
    width: 100%;
  }

  // «Тактильные» кнопки: нижняя подложка, при нажатии кнопка вдавливается
  &--primary {
    background: var(--color-primary);
    color: var(--color-on-primary);
    box-shadow: 0 4px 0 var(--color-primary-strong);
  }

  &--success {
    background: var(--color-success);
    color: #fff;
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-success) 70%, black);
  }

  &--danger {
    background: var(--color-error);
    color: #fff;
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-error) 70%, black);
  }

  &--accent {
    background: var(--color-accent);
    color: var(--color-on-accent);
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent) 70%, black);
  }

  &--primary,
  &--success,
  &--danger,
  &--accent {
    &:active:not(:disabled) {
      transform: translateY(3px);
      box-shadow: 0 1px 0 transparent;
    }

    &:hover:not(:disabled) {
      filter: brightness(1.05);
    }
  }

  &--secondary {
    background: var(--color-surface);
    color: var(--color-text-primary);
    border-color: var(--color-border);
    box-shadow: 0 3px 0 var(--color-border);

    &:hover:not(:disabled) {
      background: var(--color-surface-2);
    }

    &:active:not(:disabled) {
      transform: translateY(2px);
      box-shadow: 0 1px 0 var(--color-border);
    }
  }

  &--ghost {
    background: transparent;
    color: var(--color-primary);

    &:hover:not(:disabled) {
      background: var(--color-primary-soft);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
