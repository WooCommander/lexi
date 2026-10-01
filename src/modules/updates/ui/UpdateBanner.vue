<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import { LxButton } from '@/design-system'
import { useUpdateStore } from '../state/useUpdateStore'

const updates = useUpdateStore()
</script>

<template>
  <Transition name="update-slide">
    <div v-if="updates.bannerVisible && updates.available" class="update-banner" role="status">
      <span class="update-banner__icon"><Download :size="22" /></span>
      <div class="update-banner__text">
        <span class="update-banner__title">Доступно обновление {{ updates.available.version }}</span>
        <span v-if="updates.available.notes" class="update-banner__notes">{{ updates.available.notes.split('\n')[0] }}</span>
      </div>
      <LxButton variant="ghost" size="sm" @click="updates.dismiss()">Позже</LxButton>
      <LxButton size="sm" @click="updates.install()">Обновить</LxButton>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.update-banner {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 12px);
  z-index: 950;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 560px;
  margin: 0 auto;
  padding: var(--space-3);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-3);

  @media (min-width: 900px) {
    bottom: 20px;
  }

  &__icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 12px;
    background: var(--color-primary-soft);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__title {
    font-weight: 900;
  }

  &__notes {
    font-size: var(--text-caption);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.update-slide-enter-active,
.update-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.update-slide-enter-from,
.update-slide-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
