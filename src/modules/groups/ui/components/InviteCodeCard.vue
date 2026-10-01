<script setup lang="ts">
import { Copy, RefreshCw } from 'lucide-vue-next'
import { LxButton, LxCard, LxIconButton } from '@/design-system'
import { useNotify } from '@/shared/composables/useNotify'

defineProps<{ code?: string | null; title: string; hint: string; loading?: boolean }>()
const emit = defineEmits<{ (e: 'generate'): void }>()
const { notify } = useNotify()

const copy = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code)
    notify('Код скопирован', 'success')
  } catch {
    notify(`Код: ${code}`, 'info')
  }
}
</script>

<template>
  <LxCard tone="accent" class="invite">
    <div class="invite__text">
      <div class="invite__title">{{ title }}</div>
      <p class="caption">{{ hint }}</p>
    </div>
    <div v-if="code" class="invite__code">
      <span>{{ code }}</span>
      <LxIconButton label="Скопировать" @click="copy(code)"><Copy :size="20" /></LxIconButton>
      <LxIconButton label="Новый код" :disabled="loading" @click="emit('generate')"><RefreshCw :size="20" /></LxIconButton>
    </div>
    <LxButton v-else variant="accent" :loading="loading" @click="emit('generate')">Создать код</LxButton>
  </LxCard>
</template>

<style scoped lang="scss">
.invite {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;

  &__title {
    font-weight: 900;
  }

  &__code {
    display: flex;
    align-items: center;
    gap: 2px;

    span {
      padding: 6px 14px;
      margin-right: var(--space-2);
      border: 2px dashed var(--color-text-tertiary);
      border-radius: var(--radius-md);
      font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
      font-size: 1.375rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: var(--color-surface);
    }
  }
}
</style>
