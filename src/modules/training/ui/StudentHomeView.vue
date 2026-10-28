<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpenCheck, Flame, KeyRound, PackagePlus, Sparkles } from 'lucide-vue-next'
import { LxButton, LxCard, LxEmptyState, LxPageHeader, LxProgressBar, LxSpinner } from '@/design-system'
import { useStudyStore } from '../state/useStudyStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { wordsLabel } from '@/shared/lib/plural'

const router = useRouter()
const study = useStudyStore()
const settings = useSettingsStore()
const languages = useLanguagesStore()
const auth = useAuthStore()

const goal = computed(() => settings.goalFor())
const goalDone = computed(() => study.todayCount >= goal.value)
const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
  return `${part}, ${auth.displayName}!`
})

onMounted(async () => {
  await languages.load()
  await study.load()
})
</script>

<template>
  <div class="page">
    <LxPageHeader :title="greeting" subtitle="Выберите язык, чтобы начать">
      <template #actions>
        <LxButton variant="secondary" @click="router.push('/catalog')"><PackagePlus :size="20" /> Готовые наборы</LxButton>
      </template>
    </LxPageHeader>

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
        description="Возьмите готовый набор по теме или подключитесь к учителю по коду.">
        <template #icon><BookOpenCheck :size="36" /></template>
        <LxButton @click="router.push('/catalog')"><PackagePlus :size="20" /> Готовые наборы</LxButton>
        <LxButton variant="secondary" @click="router.push('/join')">
          <KeyRound :size="20" /> Ввести код учителя
        </LxButton>
      </LxEmptyState>
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
    // место под название в две строки + подпись: плитки статистики у всех карточек на одной линии
    min-height: 4.75rem;
  }

  &__flag {
    flex-shrink: 0;
    font-size: 2.5rem;
    line-height: 1;
  }

  &__name {
    font-size: var(--text-h3);
    font-weight: 900;
    line-height: 1.2;
    // длинные названия («Молдавский / румынский») не раздувают карточку больше двух строк
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__counts {
    margin-top: auto; // прижать к низу, если соседняя карточка выше
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
</style>
