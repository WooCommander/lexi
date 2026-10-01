<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Home, RotateCcw, Plus, PartyPopper } from 'lucide-vue-next'
import { LxButton, LxCard, LxStatTile } from '@/design-system'
import { useTrainingSession } from '../state/useTrainingSession'
import { useStudyStore } from '../state/useStudyStore'
import { wordsLabel } from '@/shared/lib/plural'

const router = useRouter()
const session = useTrainingSession()
const study = useStudyStore()

const total = computed(() => session.knownCount + session.unknownCount)
const mistakes = computed(() => {
  const byId = new Map(study.studyItems.map(s => [s.item.id, s.item]))
  return session.mistakeItemIds.map(id => byId.get(id)).filter(i => !!i)
})
const mood = computed(() => {
  const p = session.accuracyPercent
  if (p >= 90) return 'Блестяще!'
  if (p >= 70) return 'Отличная работа!'
  if (p >= 40) return 'Хорошее начало!'
  return 'Не сдавайтесь — повторение творит чудеса'
})

onMounted(() => {
  if (session.status !== 'finished') router.replace('/learn')
})

const go = (started: number) => {
  if (started) router.replace('/train')
}

const home = () => {
  const lang = session.config?.languageId
  router.replace(lang ? `/learn/${lang}` : '/learn')
}
</script>

<template>
  <div class="page page--narrow result">
    <div class="result__hero">
      <div class="result__badge"><PartyPopper :size="40" /></div>
      <h1>Тренировка завершена</h1>
      <p class="muted">{{ mood }}</p>
    </div>

    <div class="result__ring" :style="{ '--p': session.accuracyPercent }">
      <div class="result__ring-inner">
        <b>{{ session.accuracyPercent }}%</b>
        <span>правильных ответов</span>
      </div>
    </div>

    <div class="grid-stats">
      <LxStatTile label="Слов" :value="total" />
      <LxStatTile label="Знаю" :value="session.knownCount" tone="success" />
      <LxStatTile label="Не знаю" :value="session.unknownCount" tone="error" />
    </div>

    <LxCard v-if="mistakes.length" class="mistakes">
      <h2 class="section-title">Ошибки</h2>
      <ul>
        <li v-for="item in mistakes" :key="item!.id">
          <b>{{ item!.sourceText }}</b>
          <span class="muted">{{ item!.targetText }}</span>
        </li>
      </ul>
    </LxCard>

    <div class="result__actions">
      <LxButton v-if="mistakes.length" variant="accent" size="lg" block @click="go(session.repeatMistakes())">
        <RotateCcw :size="20" /> Повторить ошибки ({{ wordsLabel(mistakes.length) }})
      </LxButton>
      <LxButton size="lg" block @click="go(session.moreWords())">
        <Plus :size="20" /> Ещё {{ session.config?.size ?? 10 }} слов
      </LxButton>
      <LxButton variant="secondary" size="lg" block @click="home">
        <Home :size="20" /> На главную
      </LxButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.result {
  text-align: center;
  padding-top: calc(env(safe-area-inset-top, 0px) + var(--space-6));

  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  &__badge {
    width: 80px;
    height: 80px;
    border-radius: 26px;
    background: var(--color-accent);
    color: var(--color-on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(-6deg);
  }

  &__ring {
    --p: 0;
    width: 180px;
    height: 180px;
    margin: 0 auto;
    border-radius: 50%;
    background: conic-gradient(var(--color-success) calc(var(--p) * 1%), var(--color-surface-2) 0);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__ring-inner {
    width: 144px;
    height: 144px;
    border-radius: 50%;
    background: var(--color-background);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    b {
      font-size: 2.5rem;
      font-weight: 900;
      line-height: 1;
    }

    span {
      font-size: var(--text-caption);
      color: var(--color-text-secondary);
    }
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
}

.mistakes {
  text-align: left;

  ul {
    list-style: none;
    margin: var(--space-3) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: var(--text-h3);
  }
}
</style>
