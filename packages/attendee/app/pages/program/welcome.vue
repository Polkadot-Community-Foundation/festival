<script setup lang="ts">
const steps = [
  { illustration: '/onb-badge-1.svg', title: 'Build your personal schedule' },
  { illustration: '/onb-badge-2.svg', title: "You'll be notified before sessions start" },
]
</script>

<template>
  <OnboardingFlow :steps="steps" storage-key="build-schedule" />
</template>
