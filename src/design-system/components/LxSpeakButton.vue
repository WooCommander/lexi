<script setup lang="ts">
import { Volume2 } from 'lucide-vue-next'
import { Speech } from '@/shared/lib/speech'

/** Кнопка «🔊»: произносит текст на языке с данным кодом. Скрыта, если озвучка недоступна. */
defineProps<{ text: string; lang?: string; label?: string }>()
const emit = defineEmits<{ (e: 'speak'): void }>()

const supported = Speech.isSupported()
</script>

<template>
  <button v-if="supported" type="button" class="lx-speak" :aria-label="label ?? 'Озвучить'" :title="label ?? 'Озвучить'"
    @click.stop="Speech.speak(text, lang); emit('speak')">
    <Volume2 :size="24" />
  </button>
</template>

<style scoped lang="scss">
.lx-speak {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;

  &:hover {
    background: var(--color-surface-2);
  }

  &:active {
    transform: scale(0.94);
  }
}
</style>
