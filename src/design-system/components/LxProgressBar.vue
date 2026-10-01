<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  value: number
  max?: number
  tone?: 'primary' | 'success' | 'accent' | 'error'
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), { max: 100, tone: 'primary', size: 'md' })

const percent = computed(() => (props.max > 0 ? Math.min(100, Math.max(0, (props.value / props.max) * 100)) : 0))
</script>

<template>
  <div class="lx-progress" :class="[`tone-${tone}`, `size-${size}`]" role="progressbar" :aria-valuenow="value"
    :aria-valuemin="0" :aria-valuemax="max">
    <div class="lx-progress__fill" :style="{ width: `${percent}%` }" />
  </div>
</template>

<style scoped lang="scss">
.lx-progress {
  width: 100%;
  background: var(--color-surface-2);
  border-radius: var(--radius-pill);
  overflow: hidden;

  &.size-md { height: 14px; }
  &.size-sm { height: 8px; }

  &__fill {
    height: 100%;
    border-radius: inherit;
    transition: width 0.35s cubic-bezier(0.3, 0.7, 0.3, 1);
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.12);
  }

  &.tone-primary &__fill { background: var(--color-primary); }
  &.tone-success &__fill { background: var(--color-success); }
  &.tone-accent &__fill { background: var(--color-accent); }
  &.tone-error &__fill { background: var(--color-error); }
}
</style>
