<script setup lang="ts">
import { computed } from 'vue'
import type { DayActivity } from '../../lib/aggregate'
import { formatShortDate } from '@/shared/lib/dates'

const props = defineProps<{ days: DayActivity[] }>()

const max = computed(() => Math.max(1, ...props.days.map(d => d.correct + d.wrong)))
const total = computed(() => props.days.reduce((s, d) => s + d.correct + d.wrong, 0))
</script>

<template>
  <div class="chart">
    <div class="chart__bars" role="img" :aria-label="`Ответов за ${days.length} дней: ${total}`">
      <div v-for="d in days" :key="d.date" class="chart__col"
        :title="`${formatShortDate(d.date)}: верно ${d.correct}, ошибок ${d.wrong}`">
        <div class="chart__stack" :style="{ height: `${((d.correct + d.wrong) / max) * 100}%` }">
          <div class="chart__wrong" :style="{ flexGrow: d.wrong }" />
          <div class="chart__correct" :style="{ flexGrow: d.correct }" />
        </div>
      </div>
    </div>
    <div class="chart__axis">
      <span>{{ days[0] ? formatShortDate(days[0].date) : '' }}</span>
      <span class="chart__legend">
        <i class="dot dot--correct" /> верно
        <i class="dot dot--wrong" /> ошибки
      </span>
      <span>сегодня</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  &__bars {
    height: 140px;
    display: flex;
    align-items: flex-end;
    gap: 4px;
  }

  &__col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    border-radius: 6px;
    background: var(--color-surface-2);
  }

  &__stack {
    width: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    overflow: hidden;
  }

  &__correct {
    background: var(--color-success);
  }

  &__wrong {
    background: var(--color-error);
  }

  &__axis {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-caption);
    color: var(--color-text-tertiary);
  }

  &__legend {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;

  &--correct { background: var(--color-success); }
  &--wrong { background: var(--color-error); margin-left: 8px; }
}
</style>
