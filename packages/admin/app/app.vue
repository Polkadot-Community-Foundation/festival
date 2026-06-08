<script setup lang="ts">
import { bootApp } from '@festival/shared/host/boot'

const { allowed, environment } = bootApp()
const isDev = import.meta.dev

const buildHash = import.meta.env.VITE_BUILD_HASH || ''
const buildDate = import.meta.env.VITE_BUILD_DATE || ''
if (buildHash) {
  console.log(`[w3s-admin] build: ${buildHash.slice(0, 7)} (${buildDate})`)
} else if (isDev) {
  console.log('[w3s-admin] dev')
}
</script>

<template>
  <div v-if="!allowed && !isDev" class="min-h-screen flex items-center justify-center bg-background p-8">
    <div class="text-center max-w-md">
      <h1 class="font-heading text-2xl font-bold mb-4">Festival Admin</h1>
      <p class="text-text-secondary mb-6">
        This app runs inside the Polkadot Host. Open it from Polkadot Desktop, Web, or Mobile.
      </p>
      <p class="text-text-muted text-sm">
        Detected environment: {{ environment }}
      </p>
    </div>
  </div>

  <NuxtLayout v-else>
    <NuxtPage />
  </NuxtLayout>

  <MyAddressModal />
</template>
