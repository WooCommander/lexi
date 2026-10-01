<script setup lang="ts">
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-vue-next'
import { useNotify } from '@/shared/composables/useNotify'

const { notifications, dismiss } = useNotify()

const iconMap = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
  warning: TriangleAlert,
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup tag="div" name="lx-notif" class="lx-notif-container" aria-live="polite">
      <div v-for="n in notifications" :key="n.id" class="lx-notif" :class="`lx-notif--${n.type}`" @click="dismiss(n.id)">
        <component :is="iconMap[n.type]" :size="22" class="lx-notif__icon" />
        <span>{{ n.message }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped lang="scss">
.lx-notif-container {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  left: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.lx-notif {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 420px;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  border: 2px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-3);
  font-weight: 700;
  pointer-events: auto;
  cursor: pointer;

  &__icon {
    flex-shrink: 0;
  }

  &--success .lx-notif__icon { color: var(--color-success); }
  &--error .lx-notif__icon { color: var(--color-error); }
  &--warning .lx-notif__icon { color: var(--color-warning); }
  &--info .lx-notif__icon { color: var(--color-primary); }
}

.lx-notif-enter-active,
.lx-notif-leave-active {
  transition: all 0.25s cubic-bezier(0.3, 0.7, 0.3, 1);
}

.lx-notif-enter-from,
.lx-notif-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.96);
}
</style>
