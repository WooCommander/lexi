<script setup lang="ts">
import LxModal from './LxModal.vue'
import LxButton from './LxButton.vue'

interface Props {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger'
}

withDefaults(defineProps<Props>(), { confirmText: 'Подтвердить', cancelText: 'Отмена', variant: 'primary' })

const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'confirm'): void; (e: 'cancel'): void }>()

const cancel = () => {
  emit('update:visible', false)
  emit('cancel')
}

const confirm = () => {
  emit('confirm')
  emit('update:visible', false)
}
</script>

<template>
  <LxModal :visible="visible" :title="title" size="sm" @close="cancel">
    <p class="muted">{{ message }}</p>
    <template #footer>
      <LxButton variant="secondary" @click="cancel">{{ cancelText }}</LxButton>
      <LxButton :variant="variant" @click="confirm">{{ confirmText }}</LxButton>
    </template>
  </LxModal>
</template>
