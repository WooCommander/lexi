<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check, X } from 'lucide-vue-next'
import { LxButton, LxIconButton, LxProgressBar } from '@/design-system'
import FlashCard from './components/FlashCard.vue'
import { useTrainingSession } from '../state/useTrainingSession'
import { useStudyStore } from '../state/useStudyStore'
import { TrainingResult } from '../domain/Training'
import { useLanguagePair } from '@/modules/languages/composables/useLanguagePair'
import { LxHaptics } from '@/shared/lib/haptics'
import { useNotify } from '@/shared/composables/useNotify'

const router = useRouter()
const session = useTrainingSession()
const study = useStudyStore()
const { notify } = useNotify()

const card = computed(() => session.current)
const pair = useLanguagePair(() => card.value?.item)
const directionLabel = computed(() => (card.value ? pair.directionLabel(card.value.direction) : ''))

onMounted(() => {
  if (session.status !== 'active') router.replace('/learn')
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

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

const answer = (result: TrainingResult) => {
  if (!session.revealed) return
  if (result === TrainingResult.Correct) LxHaptics.success()
  else LxHaptics.error()
  session.answer(result)
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

// Клавиатура на ПК: пробел/Enter — показать ответ, ←/1 — не знаю, →/2 — знаю
function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (!session.revealed && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    reveal()
  } else if (session.revealed && (e.key === 'ArrowLeft' || e.key === '1')) {
    answer(TrainingResult.Wrong)
  } else if (session.revealed && (e.key === 'ArrowRight' || e.key === '2')) {
    answer(TrainingResult.Correct)
  } else if (e.key === 'Escape') {
    exit()
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
        <FlashCard :key="card.key" :card="card" :revealed="session.revealed" :retry="session.isRetry"
          :favorite="study.favorites.has(card.item.id)" @reveal="reveal" @toggle-favorite="toggleFavorite" />
      </Transition>
    </div>

    <footer class="training__actions">
      <LxButton v-if="!session.revealed" size="lg" block @click="reveal">Показать ответ</LxButton>
      <div v-else class="answer-row">
        <LxButton variant="danger" size="lg" block @click="answer(TrainingResult.Wrong)">
          <X :size="24" :stroke-width="3" /> Не знаю
        </LxButton>
        <LxButton variant="success" size="lg" block @click="answer(TrainingResult.Correct)">
          <Check :size="24" :stroke-width="3" /> Знаю
        </LxButton>
      </div>
      <p class="caption keys">Пробел — ответ · ← не знаю · → знаю</p>
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
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
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
