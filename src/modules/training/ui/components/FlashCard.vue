<script setup lang="ts">
import { computed } from 'vue'
import { Star } from 'lucide-vue-next'
import { TrainingDirection, type TrainingCard } from '../../domain/Training'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'

/**
 * Карточка — главный элемент обучения. Работает для любой языковой пары:
 * направление определяет, какая сторона словарной единицы — вопрос.
 */
const props = defineProps<{
  card: TrainingCard
  revealed: boolean
  favorite?: boolean
  retry?: boolean
}>()

const emit = defineEmits<{ (e: 'reveal'): void; (e: 'toggle-favorite'): void }>()
const languages = useLanguagesStore()

const side = computed(() => {
  const { item, direction } = props.card
  const forward = direction === TrainingDirection.Forward
  return {
    promptLang: forward ? item.sourceLanguageId : item.targetLanguageId,
    answerLang: forward ? item.targetLanguageId : item.sourceLanguageId,
    prompt: forward ? item.sourceText : item.targetText,
    answer: forward ? item.targetText : item.sourceText,
    // транскрипция всегда относится к своему языку
    promptTranscription: forward ? item.sourceTranscription : item.targetTranscription,
    answerTranscription: forward ? item.targetTranscription : item.sourceTranscription,
    example: forward ? item.exampleSource : item.exampleTarget,
    exampleTranslation: forward ? item.exampleTarget : item.exampleSource,
  }
})

const langCode = (id: string) => languages.get(id)?.code
</script>

<template>
  <div class="flashcard" :class="{ 'is-revealed': revealed }">
    <div class="flashcard__inner">
      <!-- Лицевая сторона -->
      <button class="flashcard__face flashcard__face--front" type="button" :tabindex="revealed ? -1 : 0"
        :aria-hidden="revealed" @click="emit('reveal')">
        <span class="flashcard__lang">{{ languages.flag(side.promptLang) }} {{ languages.label(side.promptLang) }}</span>
        <span v-if="retry" class="flashcard__retry">ещё раз</span>
        <span class="flashcard__word" :lang="langCode(side.promptLang)">{{ side.prompt }}</span>
        <span class="flashcard__hint">Вспомните перевод и нажмите, чтобы проверить</span>
      </button>

      <!-- Оборот -->
      <div class="flashcard__face flashcard__face--back" :aria-hidden="!revealed">
        <span class="flashcard__lang">{{ languages.flag(side.answerLang) }} {{ languages.label(side.answerLang) }}</span>
        <span class="flashcard__prompt-small" :lang="langCode(side.promptLang)">{{ side.prompt }}</span>
        <span class="flashcard__word flashcard__word--answer" :lang="langCode(side.answerLang)">{{ side.answer }}</span>
        <span v-if="side.answerTranscription || side.promptTranscription" class="flashcard__transcription">
          {{ side.answerTranscription || side.promptTranscription }}
        </span>
        <span v-if="side.example" class="flashcard__example">
          <span :lang="langCode(side.promptLang)">{{ side.example }}</span>
          <span v-if="side.exampleTranslation" class="muted">{{ side.exampleTranslation }}</span>
        </span>
      </div>
    </div>

    <button type="button" class="flashcard__star" :class="{ active: favorite }"
      :aria-label="favorite ? 'Убрать из избранного' : 'В избранное'" @click.stop="emit('toggle-favorite')">
      <Star :size="24" :fill="favorite ? 'currentColor' : 'none'" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.flashcard {
  position: relative;
  width: 100%;
  max-width: 560px;
  aspect-ratio: 4 / 3;
  max-height: 52dvh;
  margin: 0 auto;
  perspective: 1400px;

  &__inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.45s cubic-bezier(0.3, 0.7, 0.3, 1);
  }

  &.is-revealed &__inner {
    transform: rotateY(180deg);
  }

  &__face {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-5);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-xl);
    background: var(--color-surface);
    box-shadow: 0 8px 0 var(--color-border), var(--shadow-2);
    backface-visibility: hidden;
    text-align: center;
    font: inherit;
    color: inherit;

    &--front {
      cursor: pointer;
    }

    &--back {
      transform: rotateY(180deg);
      // лёгкая «бумажная» подложка оборота
      background:
        linear-gradient(var(--color-primary-soft), var(--color-primary-soft)),
        var(--color-surface);
    }
  }

  &__lang {
    position: absolute;
    top: var(--space-4);
    left: var(--space-5);
    font-size: var(--text-caption);
    font-weight: 800;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__retry {
    position: absolute;
    top: var(--space-4);
    right: 72px;
    padding: 2px 10px;
    border-radius: var(--radius-pill);
    background: var(--color-warning-soft);
    color: var(--color-warning);
    font-size: var(--text-caption);
    font-weight: 800;
  }

  &__word {
    font-size: clamp(2rem, 8vw, var(--text-display));
    font-weight: 900;
    line-height: 1.15;
    word-break: break-word;

    &--answer {
      color: var(--color-primary);
    }
  }

  &__prompt-small {
    font-size: var(--text-h3);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  &__hint {
    margin-top: var(--space-3);
    font-size: var(--text-small);
    color: var(--color-text-tertiary);
  }

  &__transcription {
    font-size: var(--text-h3);
    color: var(--color-text-secondary);
  }

  &__example {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--space-3);
    font-size: var(--text-small);
    font-style: italic;
  }

  &__star {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &.active {
      color: var(--color-accent);
    }

    &:hover {
      background: var(--color-surface-2);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .flashcard__inner {
    transition: none;
  }
}
</style>
