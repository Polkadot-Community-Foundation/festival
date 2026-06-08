<script setup lang="ts">
import { isValidEvmAddress } from '@festival/shared/utils/address'

definePageMeta({
  validate: (route) => isValidEvmAddress(route.params.address as string),
})

const route = useRoute()
const addr = route.params.address as string
navigateTo(`/my/manage/${addr}/edit`, { replace: true })
</script>

<template>
  <div />
</template>
