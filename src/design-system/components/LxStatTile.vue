<script setup lang="ts">
interface Props {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'error'
}

withDefaults(defineProps<Props>(), { tone: 'default' })
</script>

<template>
  <div class="lx-stat" :class="`tone-${tone}`">
    <span class="lx-stat__value">{{ value }}</span>
    <span class="lx-stat__label">{{ label }}</span>
    <span v-if="hint" class="lx-stat__hint">{{ hint }}</span>
  </div>
</template>

<style scoped lang="scss">
.lx-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 2px solid var(--color-border);

  &__value {
    font-size: 1.875rem;
    font-weight: 900;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  &__label {
    font-size: var(--text-small);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  &__hint {
    font-size: var(--text-caption);
    color: var(--color-text-tertiary);
  }

  &.tone-primary &__value { color: var(--color-primary); }
  &.tone-success &__value { color: var(--color-success); }
  &.tone-warning &__value { color: var(--color-warning); }
  &.tone-error &__value { color: var(--color-error); }
}
</style>
