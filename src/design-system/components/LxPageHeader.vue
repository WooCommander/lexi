<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import LxIconButton from './LxIconButton.vue'

const props = defineProps<{ title: string; subtitle?: string; back?: string | boolean }>()
const router = useRouter()

const goBack = () => {
  if (typeof props.back === 'string') router.push(props.back)
  else router.back()
}
</script>

<template>
  <header class="lx-page-header">
    <LxIconButton v-if="back" label="Назад" variant="surface" @click="goBack">
      <ArrowLeft :size="22" />
    </LxIconButton>
    <div class="lx-page-header__text">
      <h1 class="lx-page-header__title">{{ title }}</h1>
      <p v-if="subtitle || $slots.subtitle" class="lx-page-header__subtitle">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="lx-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
.lx-page-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;

  &__text {
    flex: 1;
    min-width: 200px;
  }

  &__title {
    font-size: var(--text-h1);
    font-weight: 900;
    letter-spacing: -0.01em;
  }

  &__subtitle {
    margin-top: 2px;
    color: var(--color-text-secondary);
  }

  &__actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
}
</style>
