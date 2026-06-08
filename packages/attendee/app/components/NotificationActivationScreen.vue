<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import NotificationActivation from '~/components/NotificationActivation.vue'

// Post-claim overlay; shares BadgeEarnedFestivalScreen's full-screen chrome
// (Escape to dismiss, CTA focused on mount).

const emit = defineEmits<{ dismiss: [] }>()

const dismiss = () => emit('dismiss')
const ctaRef = ref<HTMLButtonElement | null>(null)

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    dismiss()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  void nextTick(() => ctaRef.value?.focus())
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 md:left-[var(--col-l)] md:right-[var(--col-r)] z-[2110] flex flex-col bg-background text-white"
      data-testid="notification-activation-screen"
      role="dialog"
      aria-label="Turn on notifications"
      style="
        padding-top: calc(var(--safe-top, 0px) + 56px);
        padding-bottom: calc(var(--safe-bottom, 0px) + 24px);
      "
    >
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
        <NotificationActivation class="flex-1" />
      </div>

      <button
        ref="ctaRef"
        type="button"
        class="mx-6 mt-6 h-14 shrink-0 rounded-2xl bg-white/20 text-base font-medium text-white hover:bg-white/30 transition-colors cursor-pointer"
        data-testid="notification-activation-dismiss"
        @click="dismiss"
      >
        Do it later
      </button>
    </div>
  </Teleport>
</template>
