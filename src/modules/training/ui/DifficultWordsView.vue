<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RotateCcw, ThumbsUp } from 'lucide-vue-next'
import { LxBadge, LxButton, LxCard, LxEmptyState, LxPageHeader } from '@/design-system'
import { useStudyStore } from '../state/useStudyStore'
import { useTrainingSession } from '../state/useTrainingSession'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { mistakesLabel, wordsLabel } from '@/shared/lib/plural'

const route = useRoute()
const router = useRouter()
const study = useStudyStore()
const session = useTrainingSession()
const languages = useLanguagesStore()

const languageId = computed(() => String(route.params.languageId))
const difficult = computed(() => study.difficultItems(languageId.value))

onMounted(() => study.load())

const repeat = () => {
  const ids = difficult.value.map(d => d.study.item.id)
  if (session.start({ languageId: languageId.value, size: ids.length, mode: 'mixed', itemIds: ids })) {
    router.push('/train')
  }
}
</script>

<template>
  <div class="page page--narrow">
    <LxPageHeader :back="`/learn/${languageId}`" title="Сложные слова"
      :subtitle="`${languages.flag(languageId)} ${languages.label(languageId)}`" />

    <LxEmptyState v-if="!difficult.length" title="Сложных слов нет"
      description="Слова попадают сюда, если вы часто в них ошибаетесь.">
      <template #icon><ThumbsUp :size="36" /></template>
    </LxEmptyState>

    <template v-else>
      <LxCard padding="none">
        <ul class="list">
          <li v-for="d in difficult" :key="d.study.item.id" class="list__row">
            <div>
              <div class="list__word">{{ d.study.item.sourceText }}</div>
              <div class="muted">{{ d.study.item.targetText }}</div>
            </div>
            <LxBadge tone="error">{{ mistakesLabel(d.progress.wrongAnswers) }}</LxBadge>
          </li>
        </ul>
      </LxCard>
      <LxButton size="lg" block @click="repeat">
        <RotateCcw :size="20" /> Повторить {{ wordsLabel(difficult.length) }}
      </LxButton>
    </template>
  </div>
</template>

<style scoped lang="scss">
.list {
  list-style: none;
  margin: 0;
  padding: 0;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);

    & + & {
      border-top: 2px solid var(--color-border);
    }
  }

  &__word {
    font-size: var(--text-h3);
    font-weight: 800;
  }
}
</style>
