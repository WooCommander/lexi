<script setup lang="ts">
import { computed, ref } from 'vue'
import { LxBadge, LxSegmented } from '@/design-system'
import { formatPercent, type WordStatsRow } from '../../lib/aggregate'
import { STATUS_LABELS, WordLearningStatus } from '@/modules/training/domain/Training'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'

/** Статистика по каждому слову в обоих направлениях: «English → Русский 92%, Русский → English 55%». */
const props = defineProps<{ rows: WordStatsRow[]; favorites?: ReadonlySet<string> }>()
const languages = useLanguagesStore()

type Filter = 'all' | 'difficult' | 'learning' | 'favorites'
const filter = ref<Filter>('all')
const query = ref('')

const filterOptions = computed(() => [
  { value: 'all' as Filter, label: 'Все' },
  { value: 'difficult' as Filter, label: 'Сложные' },
  { value: 'learning' as Filter, label: 'Изучаются' },
  ...(props.favorites ? [{ value: 'favorites' as Filter, label: '⭐' }] : []),
])

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.rows
    .filter(r => {
      if (filter.value === 'difficult' && !r.difficult) return false
      if (filter.value === 'learning' && r.status !== WordLearningStatus.Learning) return false
      if (filter.value === 'favorites' && !props.favorites?.has(r.item.id)) return false
      return !q || r.item.sourceText.toLowerCase().includes(q) || r.item.targetText.toLowerCase().includes(q)
    })
    .sort((a, b) => (b.progress?.wrongAnswers ?? 0) - (a.progress?.wrongAnswers ?? 0))
    .slice(0, 300)
})

const short = (id: string) => languages.get(id)?.code.toUpperCase() ?? '?'
const statusTone = (s: WordLearningStatus) => (s === WordLearningStatus.Learned ? 'success' : s === WordLearningStatus.Learning ? 'primary' : 'neutral')
const accTone = (v: number | null) => (v === null ? '' : v >= 0.8 ? 'good' : v >= 0.5 ? 'mid' : 'bad')
</script>

<template>
  <div class="stack">
    <div class="filters">
      <LxSegmented v-model="filter" :options="filterOptions" />
      <input v-model="query" class="lx-field__input filters__search" placeholder="Поиск слова" />
    </div>
    <div class="lx-table-wrap">
      <table class="lx-table">
        <thead>
          <tr>
            <th>Слово</th>
            <th>Статус</th>
            <th class="num">Прямое</th>
            <th class="num">Обратное</th>
            <th class="num">Ошибок</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in visible" :key="r.item.id">
            <td>
              <b>{{ r.item.sourceText }}</b> <span class="muted">/ {{ r.item.targetText }}</span>
              <LxBadge v-if="r.difficult" tone="error">сложное</LxBadge>
            </td>
            <td><LxBadge :tone="statusTone(r.status)">{{ STATUS_LABELS[r.status] }}</LxBadge></td>
            <td class="num" :class="accTone(r.forwardAccuracy)"
              :title="`${short(r.item.sourceLanguageId)} → ${short(r.item.targetLanguageId)}`">
              {{ formatPercent(r.forwardAccuracy) }}
            </td>
            <td class="num" :class="accTone(r.reverseAccuracy)"
              :title="`${short(r.item.targetLanguageId)} → ${short(r.item.sourceLanguageId)}`">
              {{ formatPercent(r.reverseAccuracy) }}
            </td>
            <td class="num">{{ r.progress?.wrongAnswers ?? 0 }}</td>
          </tr>
          <tr v-if="!visible.length">
            <td colspan="5" class="muted">Ничего не найдено</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.filters {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;

  &__search {
    flex: 1;
    min-width: 180px;
  }
}

td.good { color: var(--color-success); font-weight: 800; }
td.mid { color: var(--color-warning); font-weight: 800; }
td.bad { color: var(--color-error); font-weight: 800; }
</style>
