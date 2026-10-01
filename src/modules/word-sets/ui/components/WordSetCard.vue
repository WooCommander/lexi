<script setup lang="ts">
import { LxBadge, LxCard } from '@/design-system'
import { WORD_SOURCE_LABELS, WordSource, type WordSet } from '../../domain/WordSet'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { wordsLabel } from '@/shared/lib/plural'

defineProps<{ set: WordSet; showSource?: boolean }>()
const emit = defineEmits<{ (e: 'open'): void }>()
const languages = useLanguagesStore()
</script>

<template>
  <LxCard interactive class="set-card" @click="emit('open')">
    <div class="set-card__flags">
      <span>{{ languages.flag(set.sourceLanguageId) }}</span>
      <span class="set-card__arrow">→</span>
      <span>{{ languages.flag(set.targetLanguageId) }}</span>
    </div>
    <div class="set-card__name">{{ set.name }}</div>
    <div class="set-card__meta">
      <span class="caption">{{ wordsLabel(set.itemCount) }}</span>
      <LxBadge v-if="showSource" :tone="set.source === WordSource.Teacher ? 'primary' : 'neutral'">
        {{ WORD_SOURCE_LABELS[set.source] }}
      </LxBadge>
    </div>
  </LxCard>
</template>

<style scoped lang="scss">
.set-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  &__flags {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 1.5rem;
  }

  &__arrow {
    font-size: 1rem;
    color: var(--color-text-tertiary);
  }

  &__name {
    font-size: var(--text-h3);
    font-weight: 900;
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
}
</style>
