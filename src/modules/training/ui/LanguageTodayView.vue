<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Play, Star, TriangleAlert, Lock } from 'lucide-vue-next'
import { LxButton, LxCard, LxPageHeader, LxProgressBar, LxSegmented, LxSpinner, LxStatTile } from '@/design-system'
import { useStudyStore } from '../state/useStudyStore'
import { useTrainingSession } from '../state/useTrainingSession'
import { SESSION_SIZES, TRAINING_MODE_LABELS, TrainingDirection, type TrainingMode } from '../domain/Training'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useNotify } from '@/shared/composables/useNotify'
import { LxHaptics } from '@/shared/lib/haptics'

const route = useRoute()
const router = useRouter()
const study = useStudyStore()
const session = useTrainingSession()
const settings = useSettingsStore()
const languages = useLanguagesStore()
const { notify } = useNotify()

const languageId = computed(() => String(route.params.languageId))
const summary = computed(() => study.summaryFor(languageId.value))
const goal = computed(() => settings.goalFor(languageId.value))
const todayCount = computed(() => study.todayCountFor(languageId.value))
const favoriteIds = computed(() =>
  study.itemsForLanguage(languageId.value).filter(s => study.favorites.has(s.item.id)).map(s => s.item.id),
)

const size = ref<number>(10)
const mode = ref<TrainingMode>('mixed')

const sizeOptions = SESSION_SIZES.map(n => ({ value: n as number, label: String(n) }))
const modeOptions = (['mixed', TrainingDirection.Forward, TrainingDirection.Reverse] as TrainingMode[]).map(m => ({
  value: m,
  label: TRAINING_MODE_LABELS[m],
}))

/** Подпись направления: «English → Русский» в зависимости от пары слов языка. */
const modeHint = computed(() => {
  const sample = study.itemsForLanguage(languageId.value)[0]?.item
  if (!sample || mode.value === 'mixed') return 'Направление карточки выбирается автоматически'
  const [a, b] = mode.value === TrainingDirection.Forward
    ? [sample.sourceLanguageId, sample.targetLanguageId]
    : [sample.targetLanguageId, sample.sourceLanguageId]
  return `${languages.label(a)} → ${languages.label(b)}`
})

onMounted(async () => {
  await Promise.all([study.load(), settings.load()])
  const preferred = settings.settings?.sessionSize ?? 10
  size.value = (SESSION_SIZES as readonly number[]).includes(preferred) ? preferred : 10
})

const start = (itemIds?: string[]) => {
  LxHaptics.medium()
  const count = session.start({
    languageId: languageId.value,
    size: itemIds?.length ?? size.value,
    mode: mode.value,
    itemIds,
  })
  if (!count) {
    notify('Сейчас нечего повторять — загляните позже или добавьте слова', 'info')
    return
  }
  router.push('/train')
}
</script>

<template>
  <div class="page page--narrow">
    <LxPageHeader back="/learn" :title="`${languages.flag(languageId)} ${languages.label(languageId)}`" />

    <div v-if="study.isLoading && !study.material" class="center"><LxSpinner /></div>

    <template v-else>
      <section class="section">
        <h2 class="section-title">Сегодня</h2>
        <div class="grid-stats">
          <LxStatTile label="Новых слов" :value="summary.newCount" tone="primary" />
          <LxStatTile label="На повторение" :value="summary.dueCount" tone="success" />
          <LxStatTile label="Сложных слов" :value="summary.difficultCount" tone="error" />
        </div>
        <LxCard tone="soft" padding="sm" class="goal">
          <span>Цель по языку: <b>{{ todayCount }}</b> из {{ goal }}</span>
          <LxProgressBar :value="todayCount" :max="goal" size="sm" :tone="todayCount >= goal ? 'success' : 'primary'" />
        </LxCard>
        <p v-if="summary.lockedCount" class="caption locked">
          <Lock :size="14" /> Ещё {{ summary.lockedCount }} слов откроются по расписанию задания
        </p>
      </section>

      <LxCard class="setup">
        <LxSegmented v-model="size" :options="sizeOptions" label="Сколько слов" />
        <LxSegmented v-model="mode" :options="modeOptions" label="Режим" />
        <p class="caption">{{ modeHint }}</p>
        <LxButton size="lg" block @click="start()">
          <Play :size="22" fill="currentColor" /> Начать тренировку
        </LxButton>
      </LxCard>

      <div class="extra">
        <LxButton variant="secondary" block :disabled="!summary.difficultCount"
          @click="router.push(`/learn/${languageId}/difficult`)">
          <TriangleAlert :size="20" /> Сложные слова
        </LxButton>
        <LxButton variant="secondary" block :disabled="!favoriteIds.length" @click="start(favoriteIds)">
          <Star :size="20" /> Избранное ({{ favoriteIds.length }})
        </LxButton>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}

.goal {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.locked {
  display: flex;
  align-items: center;
  gap: 6px;
}

.setup {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.extra {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);

  @media (max-width: 420px) {
    grid-template-columns: 1fr;
  }
}
</style>
