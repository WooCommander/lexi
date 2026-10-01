<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/shared/composables/useTheme'
import { useNotify } from '@/shared/composables/useNotify'
import MainLayout from '@/app/layouts/MainLayout.vue'
import { LxNotificationContainer } from '@/design-system'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useStudyStore } from '@/modules/training/state/useStudyStore'
import { useWordSetsStore } from '@/modules/word-sets/state/useWordSetsStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'

const { initTheme } = useTheme()
const { notify } = useNotify()
const route = useRoute()
const auth = useAuthStore()
const study = useStudyStore()

const layout = computed(() => route.meta.layout ?? 'default')
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

const syncAnswers = async () => {
  const sent = await study.flushPending()
  if (sent > 0) notify(`Синхронизировано ответов: ${sent}`, 'success')
}

const onOnline = () => {
  isOnline.value = true
  syncAnswers()
}
const onOffline = () => {
  isOnline.value = false
}

// Смена пользователя — сбрасываем кеши сторов
watch(
  () => auth.userId,
  (next, prev) => {
    if (prev && next !== prev) {
      study.reset()
      useWordSetsStore().reset()
    }
  },
)

onMounted(() => {
  initTheme()
  useLanguagesStore().load().catch(e => console.error('Languages load failed:', e))
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})
</script>

<template>
  <router-view v-if="layout === 'blank'" />
  <MainLayout v-else :focus="layout === 'focus'" />
  <LxNotificationContainer />

  <Transition name="fade">
    <button v-if="!isOnline || study.pendingCount > 0" class="offline-banner" :disabled="!isOnline" @click="syncAnswers">
      <template v-if="!isOnline">Нет сети — ответы сохраняются на устройстве</template>
      <template v-else>Ожидают отправки: {{ study.pendingCount }} · Повторить</template>
    </button>
  </Transition>
</template>

<style scoped lang="scss">
.offline-banner {
  position: fixed;
  left: 50%;
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 12px);
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 460px;
  padding: 10px 16px;
  border: 2px solid var(--color-warning);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-2);
  font-weight: 700;
  font-size: var(--text-small);
  cursor: pointer;
  z-index: 900;

  @media (min-width: 900px) {
    bottom: 20px;
  }

  &:disabled {
    cursor: default;
  }
}
</style>
