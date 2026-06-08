<script setup lang="ts">
import { useSubEvents } from '~/composables/useSubEvents'
import { formatTimeBerlin } from '@festival/shared/utils/time'

definePageMeta({ layout: 'festival' })

const route = useRoute()
const address = route.params.address as string
const { subEvents } = useSubEvents(address)

function formatTime(ts: number) {
  return formatTimeBerlin(new Date(ts * 1000))
}

function shortenAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-heading text-2xl font-bold" data-testid="sub-events-heading">Sessions</h2>
      <NuxtLink
        :to="`/festival/${address}/sub-events/create`"
        class="px-4 py-2 bg-primary text-black rounded-2xl text-sm hover:bg-primary-hover transition-colors"
        data-testid="sub-event-create-link"
      >
        Create Session
      </NuxtLink>
    </div>

    <div v-if="!subEvents.length" class="bg-surface rounded-xl p-8 text-center">
      <p class="text-text-muted text-sm">No sessions yet.</p>
    </div>

    <div v-else class="space-y-3">
      <NuxtLink
        v-for="se in subEvents"
        :key="se.address"
        :to="`/festival/${address}/sub-events/${se.address}`"
        class="bg-surface rounded-xl p-4 block hover:bg-surface-2 transition-colors"
      >
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div
              v-if="se.metadata.badgePixels"
              class="w-10 h-10 rounded overflow-hidden border border-border shrink-0"
            >
              <BadgeCanvas :pixels="se.metadata.badgePixels" :size="40" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="font-medium text-sm truncate">{{ se.metadata.name }}</h3>
              <p class="text-xs text-text-muted truncate">
                {{ formatTime(se.startTime) }}–{{ formatTime(se.endTime) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span
              v-if="!se.cancelled && se.flagCount > 0"
              class="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
              :class="se.flagCount >= se.flagThreshold ? 'bg-danger/12 text-danger' : 'bg-warning/12 text-warning'"
              :title="`${se.flagCount} of ${se.flagThreshold} reports`"
              data-testid="session-flag-badge"
            >
              ⚑ {{ se.flagCount }} / {{ se.flagThreshold }}
            </span>
            <span
              class="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
              :class="se.cancelled ? 'bg-danger/12 text-danger' : 'bg-success/12 text-success'"
            >
              {{ se.cancelled ? 'Cancelled' : 'Active' }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-4 text-xs text-text-muted">
          <span>{{ se.registeredCount }} registered</span>
          <span class="hidden sm:inline font-mono">{{ shortenAddr(se.address) }}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
