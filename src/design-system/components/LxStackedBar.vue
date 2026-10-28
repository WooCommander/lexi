<script setup lang="ts">
import { computed } from 'vue'

/** Состав целого одной полосой (например, роли пользователей) с легендой: значение и доля у каждой части. */
export interface StackSegment {
  key: string
  label: string
  value: number
  color: 1 | 2 | 3 | 4
}

const props = defineProps<{ segments: StackSegment[]; chartLabel: string }>()

const total = computed(() => props.segments.reduce((sum, s) => sum + s.value, 0))
const percent = (value: number) => (total.value ? Math.round((value / total.value) * 100) : 0)
</script>

<template>
  <div class="stack">
    <div class="stack__bar" role="img" :aria-label="chartLabel">
      <i v-for="s in segments.filter(x => x.value > 0)" :key="s.key" :style="{ flexGrow: s.value, background: `var(--viz-${s.color})` }"
        :title="`${s.label}: ${s.value}`" />
    </div>
    <ul class="stack__legend">
      <li v-for="s in segments" :key="s.key">
        <i class="dot" :style="{ background: `var(--viz-${s.color})` }" />
        <span>{{ s.label }}</span>
        <b>{{ s.value }}</b>
        <span class="muted">{{ percent(s.value) }}%</span>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &__bar {
    display: flex;
    gap: 2px;
    height: 16px;
    overflow: hidden;
    border-radius: 4px;
    background: var(--color-surface-2);

    i {
      display: block;
      min-width: 4px;
    }
  }

  &__legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-5);

    li {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
  }
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
