<script setup lang="ts">
import NotificationActivation from '~/components/NotificationActivation.vue'

// Help page opened from the "?" on the Announcements list.
const router = useRouter()
</script>

<template>
  <div class="-mx-4 flex flex-col min-h-[calc(100dvh-52px)] md:min-h-[100dvh]">
    <!-- Header -->
    <div class="px-4 pt-4 pb-3 flex items-center shrink-0">
      <button
        class="w-10 h-10 flex items-center justify-center -ml-2"
        aria-label="Back"
        @click="router.push('/my/notifications')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <h1 class="flex-1 text-center text-base font-semibold text-white" data-testid="how-to-activate-heading">
        How to Activate
      </h1>
      <div class="w-10" />
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6">
      <NotificationActivation class="flex-1" />
    </div>
  </div>
</template>
