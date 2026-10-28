<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Check, CircleHelp, X } from 'lucide-vue-next'
import { LxButton, LxIconButton, LxProgressBar } from '@/design-system'
import FlashCard from './components/FlashCard.vue'
import ExerciseCard from './components/ExerciseCard.vue'
import { useTrainingSession } from '../state/useTrainingSession'
import { useStudyStore } from '../state/useStudyStore'
import { TrainingDirection, TrainingResult } from '../domain/Training'
import {
  answerText,
  buildChoiceSet,
  checkTypedAnswer,
  questionText,
  verdictToResult,
  type ChoiceSet,
  type TypedVerdict,
} from '../lib/exercises'
import { useLanguagePair } from '@/modules/languages/composables/useLanguagePair'
import { LxHaptics } from '@/shared/lib/haptics'
import { useNotify } from '@/shared/composables/useNotify'
import { useSpeech } from '@/shared/composables/useSpeech'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'

const router = useRouter()
const session = useTrainingSession()
const study = useStudyStore()
const { notify } = useNotify()
const speech = useSpeech()
const languages = useLanguagesStore()
const settings = useSettingsStore()

const card = computed(() => session.current)
const pair = useLanguagePair(() => card.value?.item)
const directionLabel = computed(() => (card.value ? pair.directionLabel(card.value.direction) : ''))

/**
 * Варианты ответа фиксируются при показе карточки. Нельзя делать computed: он пересчитался бы
 * (и перетасовал варианты под пальцем) при любом фоновом обновлении слов или прогресса.
 */
const choiceSet = ref<ChoiceSet | null>(null)
watch(
  () => card.value?.key,
  () => {
    choiceSet.value =
      card.value && session.exercise === 'choice'
        ? buildChoiceSet(card.value, study.itemsForLanguage(session.config!.languageId).map(s => s.item))
        : null
  },
  { immediate: true },
)

/** Если для выбора не хватает слов, показываем обычную карточку. */
const exercise = computed(() => (session.exercise === 'choice' && !choiceSet.value ? 'cards' : session.exercise))

const pickedIndex = ref<number | null>(null)
const verdict = ref<TypedVerdict | null>(null)
/** Результат упражнения «Выбор / Письмо», ждёт нажатия «Далее». */
const pending = ref<TrainingResult | null>(null)

watch(
  () => card.value?.key,
  () => {
    pickedIndex.value = null
    verdict.value = null
    pending.value = null
  },
)

/**
 * Автоозвучка: произносим сторону на иностранном языке (не родном). Если родной язык не задан,
 * иностранной считаем исходный язык пары. Вопрос — при показе карточки, ответ — после раскрытия.
 */
const speakSide = (which: 'prompt' | 'answer') => {
  const c = card.value
  if (!speech.autoSpeak.value || !c) return
  const forward = c.direction === TrainingDirection.Forward
  const isPrompt = which === 'prompt'
  const languageId =
    forward === isPrompt ? c.item.sourceLanguageId : c.item.targetLanguageId
  const native = settings.settings?.nativeLanguageId ?? c.item.targetLanguageId
  if (languageId === native) return
  speech.speak(isPrompt ? questionText(c.item, c.direction) : answerText(c.item, c.direction), languages.get(languageId)?.code)
}

watch(() => card.value?.key, () => speakSide('prompt'), { immediate: true })
watch(
  () => session.revealed,
  revealed => {
    if (revealed) speakSide('answer')
  },
)

onMounted(() => {
  if (session.status !== 'active') router.replace('/learn')
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  speech.stop()
})

watch(
  () => session.status,
  s => {
    if (s === 'finished') router.replace('/train/result')
  },
)

const reveal = () => {
  if (session.revealed) return
  LxHaptics.medium()
  session.reveal()
}

const feedbackHaptic = (result: TrainingResult) => {
  if (result === TrainingResult.Correct) LxHaptics.success()
  else if (result === TrainingResult.Unsure) LxHaptics.warning()
  else LxHaptics.error()
}

const answer = (result: TrainingResult) => {
  if (!session.revealed) return
  feedbackHaptic(result)
  session.answer(result)
}

const pick = (index: number) => {
  if (!card.value || pending.value !== null) return
  pickedIndex.value = index
  pending.value = index === choiceSet.value?.correctIndex ? TrainingResult.Correct : TrainingResult.Wrong
  feedbackHaptic(pending.value)
  session.reveal()
}

const submitTyped = (text: string) => {
  if (!card.value || pending.value !== null) return
  verdict.value = checkTypedAnswer(text, answerText(card.value.item, card.value.direction))
  pending.value = verdictToResult(verdict.value)
  feedbackHaptic(pending.value)
  session.reveal()
}

/** «Не знаю» в упражнении: сразу показываем правильный ответ. */
const giveUp = () => {
  if (exercise.value === 'choice') pick(-1)
  else submitTyped('')
}

const next = () => {
  if (pending.value === null) return
  // pending сбросится при смене карточки (watch выше)
  session.answer(pending.value)
}

const toggleFavorite = async () => {
  if (!card.value) return
  try {
    await study.toggleFavorite(card.value.item.id)
  } catch {
    notify('Не удалось обновить избранное', 'error')
  }
}

const exit = () => {
  session.finishEarly()
  if (session.status !== 'finished') router.replace('/learn')
}

// Клавиатура на ПК. Карточки: пробел/Enter — ответ, ←/1 не знаю, ↓/2 сомневаюсь, →/3 знаю.
// Выбор: 1–4 — вариант. После ответа в упражнении: Enter/пробел — «Далее».
function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'Escape') return exit()

  if (exercise.value === 'cards') {
    if (!session.revealed && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault()
      reveal()
    } else if (session.revealed && (e.key === 'ArrowLeft' || e.key === '1')) {
      answer(TrainingResult.Wrong)
    } else if (session.revealed && (e.key === 'ArrowDown' || e.key === '2')) {
      answer(TrainingResult.Unsure)
    } else if (session.revealed && (e.key === 'ArrowRight' || e.key === '3')) {
      answer(TrainingResult.Correct)
    }
    return
  }

  if (pending.value !== null) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      next()
    }
  } else if (exercise.value === 'choice' && /^[1-9]$/.test(e.key)) {
    const index = Number(e.key) - 1
    if (index < (choiceSet.value?.options.length ?? 0)) pick(index)
  }
}
</script>

<template>
  <div v-if="card" class="training">
    <header class="training__top">
      <LxIconButton label="Завершить" variant="surface" @click="exit">
        <X :size="24" />
      </LxIconButton>
      <div class="training__progress">
        <LxProgressBar :value="session.answered" :max="session.total" />
      </div>
      <span class="training__counter">{{ Math.min(session.answered + 1, session.total) }} / {{ session.total }}</span>
    </header>

    <p class="training__direction">{{ directionLabel }}</p>

    <div class="training__card">
      <Transition name="card-swap" mode="out-in">
        <FlashCard v-if="exercise === 'cards'" :key="card.key" :card="card" :revealed="session.revealed"
          :retry="session.isRetry" :favorite="study.favorites.has(card.item.id)" @reveal="reveal"
          @toggle-favorite="toggleFavorite" />
        <ExerciseCard v-else :key="card.key" :card="card" :kind="exercise" :options="choiceSet?.options"
          :correct-index="choiceSet?.correctIndex" :picked-index="pickedIndex" :verdict="verdict"
          :retry="session.isRetry" :favorite="study.favorites.has(card.item.id)" @pick="pick" @submit="submitTyped"
          @toggle-favorite="toggleFavorite" />
      </Transition>
    </div>

    <footer class="training__actions">
      <template v-if="exercise === 'cards'">
        <LxButton v-if="!session.revealed" size="lg" block @click="reveal">Показать ответ</LxButton>
        <div v-else class="answer-row">
          <LxButton variant="danger" size="lg" block @click="answer(TrainingResult.Wrong)">
            <X :size="22" :stroke-width="3" /> Не знаю
          </LxButton>
          <LxButton variant="accent" size="lg" block @click="answer(TrainingResult.Unsure)">
            <CircleHelp :size="22" :stroke-width="3" /> Сомневаюсь
          </LxButton>
          <LxButton variant="success" size="lg" block @click="answer(TrainingResult.Correct)">
            <Check :size="22" :stroke-width="3" /> Знаю
          </LxButton>
        </div>
        <p class="caption keys">Пробел — ответ · ← не знаю · ↓ сомневаюсь · → знаю</p>
      </template>
      <template v-else>
        <LxButton v-if="pending !== null" size="lg" block @click="next">
          Далее <ArrowRight :size="22" />
        </LxButton>
        <LxButton v-else variant="ghost" size="lg" block @click="giveUp">Не знаю</LxButton>
      </template>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.training {
  min-height: 100dvh;
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: calc(env(safe-area-inset-top, 0px) + var(--space-3)) var(--space-4)
    calc(env(safe-area-inset-bottom, 0px) + var(--space-4));

  &__top {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  &__progress {
    flex: 1;
  }

  &__counter {
    min-width: 64px;
    text-align: right;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  &__direction {
    text-align: center;
    font-weight: 800;
    color: var(--color-text-secondary);
  }

  &__card {
    flex: 1;
    display: flex;
    align-items: center;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
}

.answer-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);

  // три кнопки в ряд на телефоне: компактнее отступы и шрифт
  :deep(button) {
    padding-inline: var(--space-2);
    font-size: var(--text-small);
  }
}

.keys {
  text-align: center;

  @media (hover: none) {
    display: none;
  }
}

.card-swap-enter-active,
.card-swap-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.card-swap-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.card-swap-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}
</style>
