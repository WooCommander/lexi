<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'
import LxIconButton from './LxIconButton.vue'

interface Props {
  visible: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg'
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), { size: 'md', persistent: false })
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'close'): void }>()

const close = () => {
  emit('update:visible', false)
  emit('close')
}

const onBackdrop = () => {
  if (!props.persistent) close()
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible && !props.persistent) close()
}

watch(
  () => props.visible,
  v => {
    document.body.style.overflow = v ? 'hidden' : ''
    if (v) document.addEventListener('keydown', onKey)
    else document.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lx-modal">
      <div v-if="visible" class="lx-modal-backdrop" @click.self="onBackdrop">
        <div class="lx-modal" :class="`lx-modal--${size}`" role="dialog" aria-modal="true" :aria-label="title">
          <span class="lx-modal__grabber" aria-hidden="true" />
          <header class="lx-modal__header">
            <slot name="header">
              <h2 class="lx-modal__title">{{ title }}</h2>
            </slot>
            <LxIconButton label="Закрыть" @click="close">
              <X :size="22" />
            </LxIconButton>
          </header>
          <div class="lx-modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="lx-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.lx-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(18, 22, 28, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: flex-end;
  justify-content: center;

  @media (min-width: 768px) {
    align-items: center;
    padding: var(--space-4);
  }
}

.lx-modal {
  width: 100%;
  max-height: 92dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: var(--shadow-3);

  @media (min-width: 768px) {
    border-radius: var(--radius-xl);
  }

  &--sm { max-width: 420px; }
  &--md { max-width: 560px; }
  &--lg { max-width: 760px; }

  &__grabber {
    align-self: center;
    width: 44px;
    height: 5px;
    margin-top: 8px;
    border-radius: var(--radius-pill);
    background: var(--color-border);

    @media (min-width: 768px) {
      display: none;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-3) var(--space-2) var(--space-5);
  }

  &__title {
    font-size: var(--text-h2);
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) var(--space-5) var(--space-5);
  }

  &__footer {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    padding: var(--space-3) var(--space-5) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    border-top: 2px solid var(--color-border);
  }
}

.lx-modal-enter-active,
.lx-modal-leave-active {
  transition: opacity 0.2s ease;

  .lx-modal {
    transition: transform 0.25s cubic-bezier(0.3, 0.7, 0.3, 1);
  }
}

.lx-modal-enter-from,
.lx-modal-leave-to {
  opacity: 0;

  .lx-modal {
    transform: translateY(40px);
  }
}
</style>
