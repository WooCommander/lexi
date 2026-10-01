<script setup lang="ts" generic="T extends string | number">
import { LxHaptics } from '@/shared/lib/haptics'

interface Option {
  value: T
  label: string
}

defineProps<{ modelValue: T; options: Option[]; label?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: T): void }>()

const select = (value: T) => {
  LxHaptics.light()
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="lx-segmented-wrap">
    <span v-if="label" class="lx-segmented__label">{{ label }}</span>
    <div class="lx-segmented" role="radiogroup" :aria-label="label">
      <button v-for="o in options" :key="o.value" type="button" role="radio" class="lx-segmented__item"
        :class="{ active: o.value === modelValue }" :aria-checked="o.value === modelValue" @click="select(o.value)">
        {{ o.label }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lx-segmented-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lx-segmented__label {
  font-size: var(--text-small);
  font-weight: 700;
  color: var(--color-text-secondary);
}

.lx-segmented {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--color-surface-2);
  border-radius: var(--radius-md);

  &__item {
    flex: 1;
    min-height: 44px;
    padding: 0 10px;
    border: none;
    border-radius: calc(var(--radius-md) - 4px);
    background: transparent;
    font-weight: 800;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;

    &.active {
      background: var(--color-surface);
      color: var(--color-primary);
      box-shadow: var(--shadow-1);
    }
  }
}
</style>
