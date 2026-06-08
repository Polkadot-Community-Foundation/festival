<script setup lang="ts">
import { useFestivalContext } from '~/composables/useFestivalContext'
import { usePermissions } from '~/composables/usePermissions'
import { formatTimeBerlin } from '@festival/shared/utils/time'

definePageMeta({ layout: 'festival' })

const {
  draft, isDirty, changedSections, userRoles,
  scheduleEntryStatus, deletedScheduleEntries, markerStatus, deletedMarkers,
  undoScheduleEntry, undoMarker, restoreDeletedScheduleEntry, restoreDeletedMarker,
  publish, discardChanges, txStatus, txError,
} = useFestivalContext()
const { canEditMetadata } = usePermissions(userRoles)

const newEntries = computed(() => draft.schedule.filter(e => scheduleEntryStatus(e.id) === 'new'))
const modifiedEntries = computed(() => draft.schedule.filter(e => scheduleEntryStatus(e.id) === 'modified'))
const deletedEntries = computed(() => deletedScheduleEntries())

const newMarkers = computed(() => (draft.venueMap?.markers || []).filter(m => markerStatus(m.id) === 'new'))
const modifiedMarkers = computed(() => (draft.venueMap?.markers || []).filter(m => markerStatus(m.id) === 'modified'))
const removedMarkers = computed(() => deletedMarkers())

function formatTime(iso: string) {
  if (!iso) return '—'
  return formatTimeBerlin(iso)
}
</script>

<template>
  <div>
    <h2 class="font-heading text-2xl font-bold mb-2" data-testid="changes-heading">Review Changes</h2>
    <p class="text-text-secondary text-sm mb-6">
      Review all unpublished changes before submitting. You can undo individual changes here.
    </p>

    <div v-if="!isDirty" class="bg-surface rounded-xl p-8 text-center">
      <p class="text-text-muted">No unpublished changes. Everything is up to date.</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Schedule changes -->
      <section v-if="changedSections.includes('Schedule')" class="bg-surface rounded-xl p-5">
        <h3 class="font-medium mb-4">Schedule</h3>

        <!-- Added -->
        <div v-if="newEntries.length" class="mb-4">
          <p class="text-xs font-medium text-success mb-2">Added ({{ newEntries.length }})</p>
          <div class="space-y-1.5">
            <div v-for="entry in newEntries" :key="entry.id" class="flex items-center justify-between bg-success-muted rounded-xl px-3 py-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-1.5 h-1.5 bg-success rounded-full shrink-0" />
                <span class="text-sm font-medium truncate">{{ entry.title }}</span>
                <span class="text-text-muted text-xs shrink-0">{{ formatTime(entry.start) }}</span>
              </div>
              <button class="text-xs text-text-muted hover:text-danger shrink-0 ml-2 px-2 py-1" @click="undoScheduleEntry(entry.id)">Undo</button>
            </div>
          </div>
        </div>

        <!-- Modified -->
        <div v-if="modifiedEntries.length" class="mb-4">
          <p class="text-xs font-medium text-warning mb-2">Modified ({{ modifiedEntries.length }})</p>
          <div class="space-y-1.5">
            <div v-for="entry in modifiedEntries" :key="entry.id" class="flex items-center justify-between bg-warning-muted rounded-xl px-3 py-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-1.5 h-1.5 bg-warning rounded-full shrink-0" />
                <span class="text-sm font-medium truncate">{{ entry.title }}</span>
                <span class="text-text-muted text-xs shrink-0">{{ formatTime(entry.start) }}</span>
              </div>
              <button class="text-xs text-text-muted hover:text-danger shrink-0 ml-2 px-2 py-1" @click="undoScheduleEntry(entry.id)">Undo</button>
            </div>
          </div>
        </div>

        <!-- Removed -->
        <div v-if="deletedEntries.length">
          <p class="text-xs font-medium text-danger mb-2">Removed ({{ deletedEntries.length }})</p>
          <div class="space-y-1.5">
            <div v-for="entry in deletedEntries" :key="entry.id" class="flex items-center justify-between bg-danger-muted rounded-xl px-3 py-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-1.5 h-1.5 bg-danger rounded-full shrink-0" />
                <span class="text-sm line-through text-text-muted truncate">{{ entry.title }}</span>
              </div>
              <button class="text-xs text-text-muted hover:text-primary shrink-0 ml-2 px-2 py-1" @click="restoreDeletedScheduleEntry(entry.id)">Restore</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Map marker changes -->
      <section v-if="changedSections.includes('Map markers')" class="bg-surface rounded-xl p-5">
        <h3 class="font-medium mb-4">Map Markers</h3>

        <!-- Added -->
        <div v-if="newMarkers.length" class="mb-4">
          <p class="text-xs font-medium text-success mb-2">Added ({{ newMarkers.length }})</p>
          <div class="space-y-1.5">
            <div v-for="marker in newMarkers" :key="marker.id" class="flex items-center justify-between bg-success-muted rounded-xl px-3 py-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-1.5 h-1.5 bg-success rounded-full shrink-0" />
                <span class="text-sm font-medium truncate">{{ marker.label }}</span>
                <span class="text-text-muted text-xs shrink-0">{{ marker.type }}</span>
              </div>
              <button class="text-xs text-text-muted hover:text-danger shrink-0 ml-2 px-2 py-1" @click="undoMarker(marker.id)">Undo</button>
            </div>
          </div>
        </div>

        <!-- Modified -->
        <div v-if="modifiedMarkers.length" class="mb-4">
          <p class="text-xs font-medium text-warning mb-2">Modified ({{ modifiedMarkers.length }})</p>
          <div class="space-y-1.5">
            <div v-for="marker in modifiedMarkers" :key="marker.id" class="flex items-center justify-between bg-warning-muted rounded-xl px-3 py-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-1.5 h-1.5 bg-warning rounded-full shrink-0" />
                <span class="text-sm font-medium truncate">{{ marker.label }}</span>
                <span class="text-text-muted text-xs shrink-0">{{ marker.type }}</span>
              </div>
              <button class="text-xs text-text-muted hover:text-danger shrink-0 ml-2 px-2 py-1" @click="undoMarker(marker.id)">Undo</button>
            </div>
          </div>
        </div>

        <!-- Removed -->
        <div v-if="removedMarkers.length">
          <p class="text-xs font-medium text-danger mb-2">Removed ({{ removedMarkers.length }})</p>
          <div class="space-y-1.5">
            <div v-for="marker in removedMarkers" :key="marker.id" class="flex items-center justify-between bg-danger-muted rounded-xl px-3 py-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-1.5 h-1.5 bg-danger rounded-full shrink-0" />
                <span class="text-sm line-through text-text-muted truncate">{{ marker.label }}</span>
              </div>
              <button class="text-xs text-text-muted hover:text-primary shrink-0 ml-2 px-2 py-1" @click="restoreDeletedMarker(marker.id)">Restore</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Other changed sections -->
      <section
        v-for="section in changedSections.filter(s => s !== 'Schedule' && s !== 'Map markers')"
        :key="section"
        class="bg-surface rounded-xl p-5"
      >
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-warning rounded-full" />
          <h3 class="font-medium">{{ section }}</h3>
          <span class="text-xs text-warning">modified</span>
        </div>
      </section>

      <!-- Transaction progress -->
      <div v-if="txStatus !== 'idle' && txStatus !== 'error'" class="bg-surface rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div v-if="txStatus !== 'finalized'" class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p class="text-sm font-medium">
              {{ txStatus === 'preparing' ? 'Saving metadata to Polkadot Cloud…' : '' }}
              {{ txStatus === 'signing' ? 'Waiting for your signature…' : '' }}
              {{ txStatus === 'broadcasting' ? 'Broadcasting transaction…' : '' }}
              {{ txStatus === 'in-block' ? 'Updating on-chain metadata…' : '' }}
              {{ txStatus === 'finalized' ? 'Published!' : '' }}
            </p>
            <p class="text-xs text-text-muted mt-0.5">
              {{ txStatus === 'preparing' ? 'Storing your updated festival details on the Polkadot Bulletin Chain' : '' }}
              {{ txStatus === 'signing' ? 'Approve the transaction in your wallet to update the on-chain CID' : '' }}
              {{ txStatus === 'broadcasting' ? 'Sending your transaction to the network' : '' }}
              {{ txStatus === 'in-block' ? 'Transaction included in a block, waiting for confirmation' : '' }}
              {{ txStatus === 'finalized' ? 'Your changes are now live for all attendees' : '' }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="txError" class="bg-danger-muted rounded-xl p-3 text-sm text-danger">
        {{ txError }}
      </div>

      <!-- Actions -->
      <div class="flex gap-3 pt-2">
        <button
          class="px-6 py-3 bg-primary text-black rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          :disabled="txStatus !== 'idle' && txStatus !== 'error'"
          @click="publish"
        >
          {{ txStatus === 'idle' || txStatus === 'error' ? 'Publish All Changes' : 'Publishing…' }}
        </button>
        <button
          class="px-6 py-3 bg-secondary-btn rounded-2xl text-sm text-text-secondary hover:bg-secondary-btn-hover hover:text-text-primary transition-colors"
          @click="discardChanges"
        >
          Discard All
        </button>
      </div>
    </div>
  </div>
</template>
