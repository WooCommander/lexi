<script setup lang="ts">
import { useId } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

export interface LxSelectOption {
  value: string | number
  label: string
}

interface Props {
  modelValue: string | number | null | undefined
  options: LxSelectOption[]
  label?: string
  placeholder?: string
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string | number | null): void }>()
const id = useId()

const onChange = (e: Event) => {
  const raw = (e.target as HTMLSelectElement).value
  if (raw === '') return emit('update:modelValue', null)
  const match = props.options.find(o => String(o.value) === raw)
  emit('update:modelValue', match ? match.value : raw)
}
</script>

<template>
  <div class="lx-field">
    <label v-if="label" :for="id" class="lx-field__label">{{ label }}</label>
    <div class="lx-select">
      <select :id="id" class="lx-field__input lx-select__control" :value="modelValue ?? ''" :disabled="disabled"
        @change="onChange">
        <option v-if="placeholder" value="">{{ placeholder }}</option>
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <ChevronDown class="lx-select__chevron" :size="20" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.lx-select {
  position: relative;

  &__control {
    appearance: none;
    padding-right: 42px;
    cursor: pointer;
  }

  &__chevron {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--color-text-tertiary);
  }
}
</style>
