<script setup lang="ts">
import { LxBadge, LxCard, LxPageHeader } from '@/design-system'
import { changelog } from '../changelog'
import { useUpdateStore } from '../state/useUpdateStore'
import { formatDate } from '@/shared/lib/dates'

const updates = useUpdateStore()
</script>

<template>
  <div class="page page--narrow">
    <LxPageHeader back title="Что нового" :subtitle="`Установлена версия ${updates.currentVersion}`" />

    <LxCard v-for="rel in changelog" :key="rel.version" class="release">
      <div class="release__head">
        <span class="release__version">v{{ rel.version }}</span>
        <LxBadge v-if="rel.version === updates.currentVersion" tone="success">текущая</LxBadge>
        <span class="caption">{{ formatDate(rel.date) }}</span>
      </div>
      <div v-if="rel.highlights?.length" class="release__highlights">
        <LxBadge v-for="h in rel.highlights" :key="h" tone="accent">{{ h }}</LxBadge>
      </div>
      <template v-if="rel.features?.length">
        <h3 class="release__title">Новое</h3>
        <ul><li v-for="f in rel.features" :key="f">{{ f }}</li></ul>
      </template>
      <template v-if="rel.fixes?.length">
        <h3 class="release__title">Исправлено</h3>
        <ul><li v-for="f in rel.fixes" :key="f">{{ f }}</li></ul>
      </template>
    </LxCard>
  </div>
</template>

<style scoped lang="scss">
.release {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  &__head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  &__version {
    font-size: var(--text-h2);
    font-weight: 900;
  }

  &__highlights {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__title {
    margin-top: var(--space-2);
    font-size: var(--text-body);
  }

  ul {
    margin: 0;
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
