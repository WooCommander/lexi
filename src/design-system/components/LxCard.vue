<script setup lang="ts">
interface Props {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  interactive?: boolean
  tone?: 'default' | 'soft' | 'primary' | 'accent'
}

withDefaults(defineProps<Props>(), { padding: 'md', interactive: false, tone: 'default' })
</script>

<template>
  <div class="lx-card" :class="[`p-${padding}`, `tone-${tone}`, { 'is-interactive': interactive }]">
    <slot />
  </div>
</template>

<style scoped lang="scss">
.lx-card {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  min-width: 0;

  &.p-none { padding: 0; }
  &.p-sm { padding: var(--space-3); }
  &.p-md { padding: var(--space-4) var(--space-5); }
  &.p-lg { padding: var(--space-6); }

  &.tone-soft {
    background: var(--color-surface-2);
    border-color: transparent;
  }

  &.tone-primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-on-primary);
  }

  &.tone-accent {
    background: color-mix(in srgb, var(--color-accent) 22%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-accent) 60%, transparent);
  }

  &.is-interactive {
    cursor: pointer;
    transition: transform 0.1s ease, border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-2);
    }

    &:active {
      transform: scale(0.985);
    }
  }
}
</style>
