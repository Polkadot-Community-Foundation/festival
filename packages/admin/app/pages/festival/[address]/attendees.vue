<script setup lang="ts">
import { useAttendees } from '~/composables/useAttendees'
import { formatTimestamp } from '@festival/shared/utils/time'
import { h160ToSs58, shortenAddress } from '@festival/shared/utils/address'

definePageMeta({ layout: 'festival' })

const route = useRoute()
const { filtered, search, stats, isLoading } = useAttendees(route.params.address as string)

function displayAddress(h160: string) {
  return shortenAddress(h160ToSs58(h160), 8, 6)
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
      <h2 class="font-heading text-2xl font-bold" data-testid="attendees-heading">Attendees</h2>
      <div class="text-xs text-text-muted">
        <span class="text-success">{{ stats.checkedIn }} checked in</span>
      </div>
    </div>

    <input
      v-model="search"
      type="text"
      placeholder="Search by address…"
      class="w-full px-3 py-2 mb-4 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary"
      data-testid="attendees-search"
    />

    <div class="bg-surface rounded-xl overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border bg-background/50">
            <th class="text-left px-4 py-3 text-xs text-text-muted font-medium">Address</th>
            <th class="text-left px-4 py-3 text-xs text-text-muted font-medium">Status</th>
            <th class="text-left px-4 py-3 text-xs text-text-muted font-medium">Checked in at</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="attendee in filtered"
            :key="attendee.address"
            class="border-b border-border last:border-0 hover:bg-surface-2 transition-colors"
          >
            <td class="px-4 py-3 font-mono text-xs whitespace-nowrap">{{ displayAddress(attendee.address) }}</td>
            <td class="px-4 py-3">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-success/12 text-success whitespace-nowrap">
                Checked In
              </span>
            </td>
            <td class="px-4 py-3 text-text-secondary whitespace-nowrap">{{ formatTimestamp(attendee.checkedInAt) }}</td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="3" class="px-4 py-8 text-center text-text-muted text-sm">
              {{ isLoading ? 'Loading…' : search ? 'No attendees match your search.' : 'No attendees have checked in yet.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
