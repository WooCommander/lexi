<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LxPageHeader, LxSpinner } from '@/design-system'
import StudentStatsPanel from './components/StudentStatsPanel.vue'
import { StatisticsService, type StudentsStatsData } from '../services/StatisticsService'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'
import { useStudyStore } from '@/modules/training/state/useStudyStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useNotify } from '@/shared/composables/useNotify'
import { errorMessage } from '@/shared/lib/errors'

const auth = useAuthStore()
const settings = useSettingsStore()
const study = useStudyStore()
const { notify } = useNotify()

const data = ref<StudentsStatsData | null>(null)

onMounted(async () => {
  try {
    await Promise.all([settings.load(), useLanguagesStore().load(), study.flushPending()])
    data.value = await StatisticsService.loadForStudents([auth.userId!])
    void study.load()
  } catch (e) {
    notify(errorMessage(e, 'Не удалось загрузить статистику'), 'error')
  }
})
</script>

<template>
  <div class="page">
    <LxPageHeader title="Мой прогресс" subtitle="Сколько слов изучено и где чаще ошибки" />
    <div v-if="!data" class="center"><LxSpinner /></div>
    <StudentStatsPanel v-else :data="data" :student-id="auth.userId!"
      :native-language-id="settings.settings?.nativeLanguageId ?? null" :favorites="study.favorites" />
  </div>
</template>

<style scoped lang="scss">
.center {
  display: flex;
  justify-content: center;
  padding: var(--space-7);
  color: var(--color-primary);
}
</style>
