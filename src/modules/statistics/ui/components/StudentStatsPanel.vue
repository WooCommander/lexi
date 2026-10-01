<script setup lang="ts">
import { computed } from 'vue'
import { LxCard, LxProgressBar, LxStatTile } from '@/design-system'
import ActivityChart from './ActivityChart.vue'
import WordStatsTable from './WordStatsTable.vue'
import { activityByDay, byDirection, formatPercent, streakDays, summarize, wordStats } from '../../lib/aggregate'
import { progressMapFor, studentItemIds, type StudentsStatsData } from '../../services/StatisticsService'
import { studiedLanguageId } from '@/modules/languages/domain/Language'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { TrainingDirection } from '@/modules/training/domain/Training'
import { formatDate } from '@/shared/lib/dates'

/**
 * Статистика одного ученика: общая, по языкам, по наборам, по направлениям и по словам.
 * Один компонент для ученика, родителя и учителя.
 */
const props = defineProps<{
  data: StudentsStatsData
  studentId: string
  nativeLanguageId: string | null
  favorites?: ReadonlySet<string>
}>()

const languages = useLanguagesStore()

const progress = computed(() => progressMapFor(props.data, props.studentId))
const itemIds = computed(() => {
  const ids = studentItemIds(props.data, props.studentId)
  // слова с прогрессом из удалённых наборов тоже учитываем
  for (const id of progress.value.keys()) if (props.data.items.has(id)) ids.add(id)
  return ids
})
const history = computed(() => props.data.history.filter(h => h.studentId === props.studentId))

const overall = computed(() => summarize(itemIds.value, progress.value))
const streak = computed(() => streakDays(history.value))
const activity = computed(() => activityByDay(history.value, 14))

const perLanguage = computed(() => {
  const groups = new Map<string, string[]>()
  for (const id of itemIds.value) {
    const item = props.data.items.get(id)
    if (!item) continue
    const lang = studiedLanguageId(item, props.nativeLanguageId)
    groups.set(lang, [...(groups.get(lang) ?? []), id])
  }
  return [...groups.entries()].map(([languageId, ids]) => {
    const list = ids.map(id => progress.value.get(id)).filter(p => !!p)
    return { languageId, summary: summarize(ids, progress.value), directions: byDirection(list) }
  })
})

const perSet = computed(() =>
  props.data.sets
    .filter(s => s.ownerId === props.studentId || props.data.assignments.some(a => a.wordSetId === s.id && a.studentIds.includes(props.studentId)))
    .map(set => {
      const ids = props.data.entries.filter(e => e.wordSetId === set.id).map(e => e.item.id)
      const assignment = props.data.assignments.find(a => a.wordSetId === set.id && a.studentIds.includes(props.studentId))
      return { set, summary: summarize(ids, progress.value), dueAt: assignment?.dueAt }
    }),
)

const wordRows = computed(() =>
  [...itemIds.value]
    .map(id => props.data.items.get(id))
    .filter(i => !!i)
    .map(item => wordStats(item!, progress.value.get(item!.id))),
)

const dirLabel = (languageId: string, direction: TrainingDirection) => {
  const sample = [...itemIds.value].map(id => props.data.items.get(id)).find(i => i && studiedLanguageId(i, props.nativeLanguageId) === languageId)
  if (!sample) return direction === TrainingDirection.Forward ? 'Прямое' : 'Обратное'
  const [a, b] = direction === TrainingDirection.Forward
    ? [sample.sourceLanguageId, sample.targetLanguageId]
    : [sample.targetLanguageId, sample.sourceLanguageId]
  return `${languages.label(a)} → ${languages.label(b)}`
}
</script>

<template>
  <div class="stats">
    <section class="grid-stats">
      <LxStatTile label="Всего слов" :value="overall.total" />
      <LxStatTile label="Изучено" :value="overall.learned" tone="success" />
      <LxStatTile label="Изучается" :value="overall.learning" tone="primary" />
      <LxStatTile label="Новых" :value="overall.fresh" />
      <LxStatTile label="Точность" :value="formatPercent(overall.accuracy)" tone="warning" />
      <LxStatTile label="Дней подряд" :value="streak" />
    </section>

    <LxCard>
      <h2 class="section-title">Активность за 2 недели</h2>
      <ActivityChart :days="activity" />
    </LxCard>

    <section v-if="perLanguage.length" class="section">
      <h2 class="section-title">По языкам</h2>
      <div class="grid-cards">
        <LxCard v-for="l in perLanguage" :key="l.languageId" class="lang">
          <div class="lang__title">{{ languages.flag(l.languageId) }} {{ languages.label(l.languageId) }}</div>
          <LxProgressBar :value="l.summary.learned" :max="l.summary.total" tone="success" />
          <dl class="lang__grid">
            <dt>Всего слов</dt><dd>{{ l.summary.total }}</dd>
            <dt>Изучено</dt><dd>{{ l.summary.learned }}</dd>
            <dt>Изучается</dt><dd>{{ l.summary.learning }}</dd>
            <dt>Новых</dt><dd>{{ l.summary.fresh }}</dd>
            <dt>Точность</dt><dd>{{ formatPercent(l.summary.accuracy) }}</dd>
            <template v-for="d in l.directions" :key="d.direction">
              <dt>{{ dirLabel(l.languageId, d.direction) }}</dt><dd>{{ formatPercent(d.accuracy) }}</dd>
            </template>
          </dl>
        </LxCard>
      </div>
    </section>

    <section v-if="perSet.length" class="section">
      <h2 class="section-title">По наборам</h2>
      <div class="lx-table-wrap">
        <table class="lx-table">
          <thead>
            <tr><th>Набор</th><th class="num">Слов</th><th class="num">Изучено</th><th class="num">Точность</th><th>Срок</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in perSet" :key="s.set.id">
              <td>{{ languages.flag(s.set.sourceLanguageId) }} {{ s.set.name }}</td>
              <td class="num">{{ s.summary.total }}</td>
              <td class="num">{{ s.summary.learned }}</td>
              <td class="num">{{ formatPercent(s.summary.accuracy) }}</td>
              <td>{{ s.dueAt ? formatDate(s.dueAt) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="wordRows.length" class="section">
      <h2 class="section-title">По словам</h2>
      <WordStatsTable :rows="wordRows" :favorites="favorites" />
    </section>
  </div>
</template>

<style scoped lang="scss">
.stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.lang {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &__title {
    font-size: var(--text-h3);
    font-weight: 900;
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px var(--space-3);
    margin: 0;

    dt {
      color: var(--color-text-secondary);
    }

    dd {
      margin: 0;
      font-weight: 800;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  }
}
</style>
