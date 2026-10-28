<script setup lang="ts">
import { computed, ref } from 'vue'
import { compactNumber, niceAxis } from '@/shared/lib/numbers'

/**
 * Столбчатый график с одной или несколькими сериями (серии складываются в столбец).
 * Столбцы тонкие (≤ 24px), со скруглённым верхом и зазором 2px между сегментами; подписана ось Y,
 * по наведению — подсказка, под графиком — легенда (если серий больше одной) и табличный вид.
 */
export interface BarSeries {
  key: string
  label: string
  /** Слот палитры графиков: 1–4 (порядок фиксирован, цвет закреплён за сущностью). */
  color: 1 | 2 | 3 | 4
}

export interface BarPoint {
  label: string
  /** Подпись для подсказки (например, «понедельник, 12 окт.»). */
  title?: string
  values: Record<string, number>
}

const props = withDefaults(defineProps<{ series: BarSeries[]; points: BarPoint[]; chartLabel: string; height?: number }>(), {
  height: 180,
})

const hovered = ref<number | null>(null)
const showTable = ref(false)

const totalOf = (p: BarPoint) => props.series.reduce((sum, s) => sum + (p.values[s.key] ?? 0), 0)
const axis = computed(() => niceAxis(Math.max(0, ...props.points.map(totalOf))))
const ticks = computed(() => {
  const list: number[] = []
  for (let v = 0; v <= axis.value.top; v += axis.value.step) list.push(v)
  return list
})

/** Подписи оси X через одну-две, чтобы не слипались. */
const labelEvery = computed(() => Math.max(1, Math.ceil(props.points.length / 8)))

const segments = (p: BarPoint) => {
  const parts = props.series.map(s => ({ series: s, value: p.values[s.key] ?? 0 })).filter(x => x.value > 0)
  // нижний сегмент — последний в серии (рисуем с baseline снизу вверх)
  return parts.reverse()
}
const share = (value: number) => `${(value / axis.value.top) * 100}%`
</script>

<template>
  <figure class="bars">
    <div v-if="!showTable" class="bars__plot" :style="{ height: `${height}px` }" role="img" :aria-label="chartLabel">
      <div class="bars__yaxis" aria-hidden="true">
        <span v-for="t in ticks" :key="t" :style="{ bottom: share(t) }">{{ compactNumber(t) }}</span>
      </div>
      <div class="bars__area">
        <i v-for="t in ticks" :key="`g${t}`" class="bars__grid" :style="{ bottom: share(t) }" aria-hidden="true" />
        <div v-for="(p, i) in points" :key="i" class="bars__col" @mouseenter="hovered = i" @mouseleave="hovered = null"
          @focus="hovered = i" @blur="hovered = null" tabindex="0">
          <div class="bars__stack" :style="{ height: share(totalOf(p)) }">
            <i v-for="seg in segments(p)" :key="seg.series.key" class="bars__seg"
              :style="{ flexGrow: seg.value, background: `var(--viz-${seg.series.color})` }" />
          </div>
          <div v-if="hovered === i" class="bars__tip" role="tooltip">
            <b>{{ p.title ?? p.label }}</b>
            <span v-for="s in series" :key="s.key">
              <i class="dot" :style="{ background: `var(--viz-${s.color})` }" /> {{ s.label }}: {{ p.values[s.key] ?? 0 }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!showTable" class="bars__xaxis" aria-hidden="true">
      <span v-for="(p, i) in points" :key="i">{{ i % labelEvery === 0 ? p.label : '' }}</span>
    </div>

    <div v-else class="lx-table-wrap">
      <table class="lx-table">
        <thead>
          <tr>
            <th>{{ chartLabel }}</th>
            <th v-for="s in series" :key="s.key" class="num">{{ s.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in points" :key="i">
            <td>{{ p.title ?? p.label }}</td>
            <td v-for="s in series" :key="s.key" class="num">{{ p.values[s.key] ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <figcaption class="bars__foot">
      <span v-if="series.length > 1" class="bars__legend">
        <span v-for="s in series" :key="s.key"><i class="dot" :style="{ background: `var(--viz-${s.color})` }" /> {{ s.label }}</span>
      </span>
      <button type="button" class="bars__toggle" @click="showTable = !showTable">
        {{ showTable ? 'График' : 'Таблица' }}
      </button>
    </figcaption>
  </figure>
</template>

<style scoped lang="scss">
.bars {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  &__plot {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: var(--space-2);
  }

  &__yaxis {
    position: relative;
    font-size: var(--text-caption);
    color: var(--color-text-tertiary);
    text-align: right;

    span {
      position: absolute;
      right: 0;
      transform: translateY(50%);
    }
  }

  &__area {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 2px;
  }

  &__grid {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--viz-grid);
    pointer-events: none;
  }

  &__col {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    outline: none;

    // большая зона наведения — шире самого столбца
    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
    }
  }

  &__stack {
    width: 100%;
    max-width: 24px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    border-radius: 4px 4px 0 0;
  }

  &__seg {
    display: block;
    min-height: 2px;
  }

  &__tip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 140px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-2);
    font-size: var(--text-caption);
    white-space: nowrap;
    pointer-events: none;
  }

  &__xaxis {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    margin-left: calc(40px + var(--space-2));
    gap: 2px;
    font-size: var(--text-caption);
    color: var(--color-text-tertiary);

    span {
      overflow: visible;
      white-space: nowrap;
      text-align: center;
      min-width: 0;
    }
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 32px;
    font-size: var(--text-caption);
    color: var(--color-text-secondary);
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  &__toggle {
    margin-left: auto;
    min-height: 32px;
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius-pill);
    background: var(--color-surface-2);
    color: var(--color-text-secondary);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border-radius: 50%;
  vertical-align: baseline;
}
</style>
