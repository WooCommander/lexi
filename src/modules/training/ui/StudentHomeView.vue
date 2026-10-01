<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpenCheck, Flame, KeyRound, Sparkles } from 'lucide-vue-next'
import { LxButton, LxCard, LxEmptyState, LxPageHeader, LxProgressBar, LxSpinner } from '@/design-system'
import { useStudyStore } from '../state/useStudyStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useWordSetsStore } from '@/modules/word-sets/state/useWordSetsStore'
import { WordSetService } from '@/modules/word-sets/services/WordSetService'
import { WordSource } from '@/modules/word-sets/domain/WordSet'
import { STARTER_SETS, type StarterSet } from '@/modules/vocabulary/lib/starterSets'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'
import { wordsLabel } from '@/shared/lib/plural'

const router = useRouter()
const study = useStudyStore()
const settings = useSettingsStore()
const languages = useLanguagesStore()
const auth = useAuthStore()
const { notify } = useNotify()

const creatingStarter = ref<string | null>(null)

const goal = computed(() => settings.goalFor())
const goalDone = computed(() => study.todayCount >= goal.value)
const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
  return `${part}, ${auth.displayName}!`
})

const availableStarters = computed(() =>
  STARTER_SETS.filter(s => languages.byCode.has(s.sourceCode) && languages.byCode.has(s.targetCode)),
)

onMounted(async () => {
  await languages.load()
  await study.load()
})

const addStarter = async (starter: StarterSet) => {
  const source = languages.byCode.get(starter.sourceCode)
  const target = languages.byCode.get(starter.targetCode)
  if (!source || !target) return
  creatingStarter.value = starter.name
  try {
    const set = await useWordSetsStore().create({
      name: starter.name,
      sourceLanguageId: source.id,
      targetLanguageId: target.id,
      source: WordSource.Personal,
    })
    await WordSetService.addWords(set, starter.words, 0)
    await study.load(true)
    notify(`Набор «${starter.name}» добавлен`, 'success')
  } catch (e) {
    notify(errorMessage(e, 'Не удалось добавить набор'), 'error')
  } finally {
    creatingStarter.value = null
  }
}
</script>

<template>
  <div class="page">
    <LxPageHeader :title="greeting" subtitle="Выберите язык, чтобы начать" />

    <LxCard v-if="study.languageSummaries.length" tone="accent" class="goal">
      <div class="goal__icon">
        <Flame v-if="!goalDone" :size="28" />
        <Sparkles v-else :size="28" />
      </div>
      <div class="goal__body">
        <div class="goal__title">
          <template v-if="goalDone">Дневная цель выполнена!</template>
          <template v-else>Цель на сегодня</template>
        </div>
        <LxProgressBar :value="study.todayCount" :max="goal" :tone="goalDone ? 'success' : 'primary'" />
      </div>
      <div class="goal__count">{{ study.todayCount }}<span>/{{ goal }}</span></div>
    </LxCard>

    <div v-if="study.isLoading && !study.material" class="center">
      <LxSpinner />
    </div>

    <p v-else-if="study.error" class="muted">{{ study.error }}</p>

    <section v-else-if="study.languageSummaries.length" class="section">
      <h2 class="section-title">Мои языки</h2>
      <div class="grid-cards">
        <LxCard v-for="s in study.languageSummaries" :key="s.languageId" interactive class="lang-card"
          @click="router.push(`/learn/${s.languageId}`)">
          <div class="lang-card__head">
            <span class="lang-card__flag">{{ languages.flag(s.languageId) }}</span>
            <div>
              <div class="lang-card__name">{{ languages.label(s.languageId) }}</div>
              <div class="caption">{{ wordsLabel(s.total) }}</div>
            </div>
          </div>
          <div class="lang-card__counts">
            <div class="count count--new"><b>{{ s.newCount }}</b><span>новых</span></div>
            <div class="count count--due"><b>{{ s.dueCount }}</b><span>на повторение</span></div>
            <div class="count count--hard"><b>{{ s.difficultCount }}</b><span>сложных</span></div>
          </div>
        </LxCard>
      </div>
    </section>

    <template v-else>
      <LxEmptyState title="Пока нет слов"
        description="Подключитесь к учителю по коду или начните со стартового набора.">
        <template #icon><BookOpenCheck :size="36" /></template>
        <LxButton @click="router.push('/join')">
          <KeyRound :size="20" /> Ввести код учителя
        </LxButton>
      </LxEmptyState>

      <section v-if="availableStarters.length" class="section">
        <h2 class="section-title">Стартовые наборы</h2>
        <div class="grid-cards">
          <LxCard v-for="s in availableStarters" :key="s.name" class="starter">
            <div class="lang-card__head">
              <span class="lang-card__flag">{{ languages.byCode.get(s.sourceCode)?.flag }}</span>
              <div>
                <div class="lang-card__name">{{ s.name }}</div>
                <div class="caption">{{ wordsLabel(s.words.length) }}</div>
              </div>
            </div>
            <LxButton variant="secondary" block :loading="creatingStarter === s.name" :disabled="!!creatingStarter"
              @click="addStarter(s)">
              Добавить
            </LxButton>
          </LxCard>
        </div>
      </section>
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
  align-items: center;
  gap: var(--space-4);

  &__icon {
    width: 52px;
    height: 52px;
    flex-shrink: 0;
    border-radius: 16px;
    background: var(--color-accent);
    color: var(--color-on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  &__title {
    font-weight: 800;
  }

  &__count {
    font-size: 1.75rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;

    span {
      font-size: 1rem;
      color: var(--color-text-tertiary);
    }
  }
}

.lang-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  &__head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  &__flag {
    font-size: 2.5rem;
    line-height: 1;
  }

  &__name {
    font-size: var(--text-h3);
    font-weight: 900;
  }

  &__counts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }
}

.count {
  display: flex;
  flex-direction: column;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);

  b {
    font-size: 1.5rem;
    font-weight: 900;
    line-height: 1.2;
  }

  span {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  &--new b { color: var(--color-info); }
  &--due b { color: var(--color-primary); }
  &--hard b { color: var(--color-error); }
}

.starter {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
