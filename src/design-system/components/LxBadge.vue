<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'accent' }>(), {
  tone: 'neutral',
})
</script>

<template>
  <span class="lx-badge" :class="`tone-${tone}`"><slot /></span>
</template>

<style scoped lang="scss">
.lx-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: 800;
  white-space: nowrap;

  &.tone-neutral { background: var(--color-surface-2); color: var(--color-text-secondary); }
  &.tone-primary { background: var(--color-primary-soft); color: var(--color-primary); }
  &.tone-success { background: var(--color-success-soft); color: var(--color-success); }
  &.tone-warning { background: var(--color-warning-soft); color: var(--color-warning); }
  &.tone-error { background: var(--color-error-soft); color: var(--color-error); }
  &.tone-accent { background: color-mix(in srgb, var(--color-accent) 30%, transparent); color: var(--color-text-primary); }
}
</style>
