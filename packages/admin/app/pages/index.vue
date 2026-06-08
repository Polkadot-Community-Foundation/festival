<script setup lang="ts">
import { FESTIVAL_ADDRESS } from '@festival/shared/contracts/addresses'

const isConfigured = FESTIVAL_ADDRESS !== '0x0000000000000000000000000000000000000000'

if (isConfigured) {
  navigateTo(`/festival/${FESTIVAL_ADDRESS}`)
} else {
  navigateTo('/create')
}
</script>

<template>
  <div class="text-center py-12 text-text-muted">Redirecting…</div>
</template>
