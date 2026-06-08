<script setup lang="ts">
import { onMounted } from 'vue'

defineProps<{ error: { statusCode?: number } }>()

onMounted(() => {
  clearError({ redirect: '/' })
})
</script>

<template>
  <div />
</template>
