<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; compact?: boolean }>(), { compact: false })
</script>

<template>
  <div class="lx-empty" :class="{ compact }">
    <div v-if="$slots.icon" class="lx-empty__icon">
      <slot name="icon" />
    </div>
    <h3 class="lx-empty__title">{{ title }}</h3>
    <p v-if="description" class="lx-empty__desc">{{ description }}</p>
    <div v-if="$slots.default" class="lx-empty__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.lx-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-2);
  padding: var(--space-7) var(--space-5);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-xl);

  &.compact {
    padding: var(--space-5) var(--space-4);
  }

  &__icon {
    width: 72px;
    height: 72px;
    border-radius: 24px;
    background: color-mix(in srgb, var(--color-accent) 25%, transparent);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-2);
    transform: rotate(-4deg);
  }

  &__title {
    font-size: var(--text-h3);
  }

  &__desc {
    max-width: 360px;
    color: var(--color-text-secondary);
  }

  &__actions {
    margin-top: var(--space-3);
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
