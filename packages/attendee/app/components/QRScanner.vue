<script setup lang="ts">
import { watch, onBeforeUnmount, useId } from 'vue'
import { useQRScanner } from '@festival/shared/scanner/useQRScanner'

const props = defineProps<{
  active: boolean
}>()

const emit = defineEmits<{
  scan: [data: string]
  error: [message: string]
}>()

const elementId = `qr-scanner-${useId()}`
const { start, stop, isActive, error } = useQRScanner()

watch(
  () => props.active,
  async (active) => {
    if (active && !isActive.value) {
      await start(elementId, (data) => emit('scan', data))
      if (error.value) emit('error', error.value)
    } else if (!active && isActive.value) {
      await stop()
    }
  },
  { immediate: true },
)

watch(error, (err) => {
  if (err) emit('error', err)
})

onBeforeUnmount(() => stop())
</script>

<template>
  <div class="qr-scanner-root">
    <div :id="elementId" class="scanner-surface overflow-hidden" />
    <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>
  </div>
</template>

<style scoped>
.qr-scanner-root {
  width: 100%;
  height: 100%;
  position: relative;
}

.scanner-surface {
  width: 100%;
  height: 100%;
}

.scanner-surface :deep(video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block;
}

.scanner-surface :deep(img) {
  display: none;
}
</style>
