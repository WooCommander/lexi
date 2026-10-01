<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 28 })
</script>

<template>
  <span class="lx-spinner" :style="{ width: `${size}px`, height: `${size}px` }" role="status" aria-label="Загрузка" />
</template>

<style scoped lang="scss">
.lx-spinner {
  display: inline-block;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, currentColor 20%, transparent);
  border-top-color: currentColor;
  animation: lx-spin 0.7s linear infinite;
}

@keyframes lx-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
