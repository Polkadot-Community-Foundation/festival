<script setup lang="ts">
const steps = [
  { illustration: '/onb-badge-3.svg', title: 'Find a community session' },
  { illustration: '/onb-badge-4.svg', title: 'Tap Collect Badge and show your QR to the host' },
  { illustration: '/onb-badge-5.svg', title: 'Get your unique badge, forever' },
]
</script>

<template>
  <OnboardingFlow :steps="steps" storage-key="receive-badge" />
</template>
