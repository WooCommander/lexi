<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, Star, X } from 'lucide-vue-next'
import { LxButton, LxSpeakButton } from '@/design-system'
import { TrainingDirection, type TrainingCard } from '../../domain/Training'
import { answerText, questionText, type TypedVerdict } from '../../lib/exercises'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'

/**
 * Упражнения «Выбери перевод» и «Напиши слово». Компонент только показывает вопрос
 * и собирает ввод; результат вычисляет родитель (TrainingView).
 */
const props = defineProps<{
  card: TrainingCard
  kind: 'choice' | 'typing'
  options?: string[]
  correctIndex?: number
  /** Индекс выбранного варианта; −1 — «Не знаю». null — ещё не отвечено. */
  pickedIndex: number | null
  verdict: TypedVerdict | null
  favorite?: boolean
  retry?: boolean
}>()

const emit = defineEmits<{
  (e: 'pick', index: number): void
  (e: 'submit', text: string): void
  (e: 'toggle-favorite'): void
}>()

const languages = useLanguagesStore()

const forward = computed(() => props.card.direction === TrainingDirection.Forward)
const promptLang = computed(() => (forward.value ? props.card.item.sourceLanguageId : props.card.item.targetLanguageId))
const answerLang = computed(() => (forward.value ? props.card.item.targetLanguageId : props.card.item.sourceLanguageId))
const prompt = computed(() => questionText(props.card.item, props.card.direction))
const answer = computed(() => answerText(props.card.item, props.card.direction))
const transcription = computed(() =>
  forward.value ? props.card.item.targetTranscription : props.card.item.sourceTranscription,
)

const promptReading = computed(() =>
  forward.value ? props.card.item.sourceReading : props.card.item.targetReading,
)
const answerReading = computed(() =>
  forward.value ? props.card.item.targetReading : props.card.item.sourceReading,
)

const answered = computed(() => (props.kind === 'choice' ? props.pickedIndex !== null : props.verdict !== null))
const isRight = computed(() =>
  props.kind === 'choice' ? props.pickedIndex === props.correctIndex : props.verdict === 'exact' || props.verdict === 'close',
)

const typed = ref('')
const input = ref<HTMLInputElement | null>(null)

const focusInput = async () => {
  await nextTick()
  input.value?.focus()
}

watch(
  () => props.card.key,
  () => {
    typed.value = ''
    if (props.kind === 'typing') focusInput()
  },
  { immediate: true },
)

const submit = () => {
  if (answered.value) return
  emit('submit', typed.value)
  // фокус уходит с поля, иначе Enter/пробел для «Далее» не дойдут до обработчика клавиш
  input.value?.blur()
}

const optionState = (i: number) => {
  if (!answered.value) return ''
  if (i === props.correctIndex) return 'is-correct'
  if (i === props.pickedIndex) return 'is-wrong'
  return 'is-dim'
}

const feedback = computed(() => {
  if (!answered.value) return ''
  if (props.kind === 'typing') {
    if (props.verdict === 'exact') return 'Верно!'
    if (props.verdict === 'close') return 'Верно! Обратите внимание на написание'
    if (props.verdict === 'typo') return 'Почти! Опечатка'
  } else if (isRight.value) {
    return 'Верно!'
  }
  return 'Правильный ответ'
})
</script>

<template>
  <div class="exercise">
    <div class="exercise__prompt">
      <span class="exercise__lang">{{ languages.flag(promptLang) }} {{ languages.label(promptLang) }}</span>
      <span v-if="retry" class="exercise__retry">ещё раз</span>
      <span class="exercise__word" :lang="languages.get(promptLang)?.code">{{ prompt }}</span>
      <span v-if="promptReading" class="exercise__reading">«{{ promptReading }}»</span>
      <LxSpeakButton class="exercise__speak" :text="prompt" :lang="languages.get(promptLang)?.code" />
      <button type="button" class="exercise__star" :class="{ active: favorite }"
        :aria-label="favorite ? 'Убрать из избранного' : 'В избранное'" @click="emit('toggle-favorite')">
        <Star :size="24" :fill="favorite ? 'currentColor' : 'none'" />
      </button>
    </div>

    <div v-if="kind === 'choice'" class="exercise__options" role="group" aria-label="Варианты перевода">
      <button v-for="(option, i) in options" :key="`${card.key}:${i}`" type="button" class="option"
        :class="optionState(i)" :disabled="answered" @click="emit('pick', i)">
        <span class="option__key">{{ i + 1 }}</span>
        <span class="option__text" :lang="languages.get(answerLang)?.code">{{ option }}</span>
        <Check v-if="answered && i === correctIndex" :size="22" :stroke-width="3" />
        <X v-else-if="answered && i === pickedIndex" :size="22" :stroke-width="3" />
      </button>
    </div>

    <form v-else class="exercise__typing" autocomplete="off" @submit.prevent="submit">
      <label class="sr-only" for="typing-answer">Ваш перевод</label>
      <input id="typing-answer" ref="input" v-model="typed" class="typing" :class="{ 'is-right': answered && isRight, 'is-wrong': answered && !isRight }"
        :readonly="answered" :lang="languages.get(answerLang)?.code" autocapitalize="off" autocorrect="off"
        spellcheck="false" :placeholder="`Перевод на «${languages.label(answerLang)}»`" />
      <LxButton v-if="!answered" type="submit" size="lg" block :disabled="!typed.trim()">Проверить</LxButton>
    </form>

    <div v-if="answered" class="feedback" :class="isRight ? 'feedback--right' : 'feedback--wrong'" role="status">
      <b>{{ feedback }}</b>
      <template v-if="!isRight">
        <span class="feedback__answer" :lang="languages.get(answerLang)?.code">{{ answer }}</span>
        <span v-if="answerReading" class="muted">«{{ answerReading }}»</span>
        <span v-if="transcription" class="muted">{{ transcription }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.exercise {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__prompt {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 150px;
    padding: var(--space-6) var(--space-5) var(--space-5);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-xl);
    background: var(--color-surface);
    box-shadow: 0 6px 0 var(--color-border), var(--shadow-2);
    text-align: center;
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
    margin-top: var(--space-3);
    font-size: clamp(1.75rem, 7vw, var(--text-display));
    font-weight: 900;
    line-height: 1.15;
    word-break: break-word;
  }

  &__speak {
    position: absolute;
    right: 10px;
    bottom: 10px;
  }

  &__reading {
    font-size: var(--text-h3);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  &__star {
    position: absolute;
    top: 10px;
    right: 10px;
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

  &__options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);

    @media (max-width: 480px) {
      grid-template-columns: 1fr;
    }
  }

  &__typing {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
}

.option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: 0 3px 0 var(--color-border);
  font: inherit;
  font-size: var(--text-h3);
  font-weight: 700;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
  }

  &:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--color-border);
  }

  &__key {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--color-surface-2);
    color: var(--color-text-secondary);
    font-size: var(--text-small);
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;

    @media (hover: none) {
      display: none;
    }
  }

  &__text {
    flex: 1;
    word-break: break-word;
  }

  &:disabled {
    cursor: default;
  }

  &.is-correct {
    border-color: var(--color-success);
    background: var(--color-success-soft);
    color: var(--color-success);
  }

  &.is-wrong {
    border-color: var(--color-error);
    background: var(--color-error-soft);
    color: var(--color-error);
  }

  &.is-dim {
    opacity: 0.55;
  }
}

.typing {
  width: 100%;
  min-height: 56px;
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font: inherit;
  font-size: var(--text-h3);
  font-weight: 700;
  color: inherit;
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  &.is-right {
    border-color: var(--color-success);
    background: var(--color-success-soft);
  }

  &.is-wrong {
    border-color: var(--color-error);
    background: var(--color-error-soft);
  }
}

.feedback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  text-align: center;

  &--right {
    background: var(--color-success-soft);
    color: var(--color-success);
  }

  &--wrong {
    background: var(--color-error-soft);
    color: var(--color-error);
  }

  &__answer {
    font-size: var(--text-h2);
    font-weight: 900;
    word-break: break-word;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
