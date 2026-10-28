<script setup lang="ts">
import { computed } from 'vue'

/**
 * Рейтинг горизонтальными полосами: подпись, полоса и значение у её конца.
 * Полоса тонкая (10px), скругление только у конца, длина — доля от максимума.
 * Цвет один (слот палитры): сравнивается величина, а не сущности.
 */
export interface HBarRow {
  key: string
  label: string
  sublabel?: string
  value: number
  /** Что показать у конца полосы (по умолчанию само число). */
  display?: string
}

const props = withDefaults(
  defineProps<{ rows: HBarRow[]; color?: 1 | 2 | 3 | 4; clickable?: boolean; empty?: string }>(),
  { color: 1, clickable: false, empty: 'Пока нет данных' },
)
const emit = defineEmits<{ (e: 'select', key: string): void }>()

const max = computed(() => Math.max(1, ...props.rows.map(r => r.value)))
</script>

<template>
  <p v-if="!rows.length" class="muted">{{ empty }}</p>
  <ol v-else class="hbars">
    <li v-for="(r, i) in rows" :key="r.key">
      <component :is="clickable ? 'button' : 'div'" class="hbars__row" :class="{ 'is-click': clickable }"
        :type="clickable ? 'button' : undefined" @click="clickable && emit('select', r.key)">
        <span class="hbars__rank">{{ i + 1 }}</span>
        <span class="hbars__body">
          <span class="hbars__head">
            <span class="hbars__label">{{ r.label }}</span>
            <span class="hbars__value">{{ r.display ?? r.value }}</span>
          </span>
          <span class="hbars__track" aria-hidden="true">
            <i class="hbars__fill" :style="{ width: `${(r.value / max) * 100}%`, background: `var(--viz-${color})` }" />
          </span>
          <span v-if="r.sublabel" class="hbars__sub">{{ r.sublabel }}</span>
        </span>
      </component>
    </li>
  </ol>
</template>

<style scoped lang="scss">
.hbars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);

  &__row {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;

    &.is-click {
      cursor: pointer;
      min-height: 44px;

      &:hover {
        background: var(--color-surface-2);
      }
    }
  }

  &__rank {
    flex: none;
    width: 24px;
    color: var(--color-text-tertiary);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  &__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  &__label {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__value {
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &__track {
    display: block;
    height: 10px;
    border-radius: 4px;
    background: var(--color-surface-2);
    overflow: hidden;
  }

  &__fill {
    display: block;
    height: 100%;
    min-width: 2px;
    border-radius: 0 4px 4px 0;
  }

  &__sub {
    font-size: var(--text-caption);
    color: var(--color-text-tertiary);
  }
}
</style>
