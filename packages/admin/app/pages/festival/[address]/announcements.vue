<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useFestivalContext } from '~/composables/useFestivalContext'
import { usePermissions } from '~/composables/usePermissions'
import { useAnnouncements, ChannelConflictError } from '~/composables/useAnnouncements'
import type { AnnouncementBody } from '@festival/shared/metadata/schemas'
import { ANNOUNCEMENT_CONTENT_MAX_CHARS } from '@festival/shared/metadata/constants'
import { fetchAnnouncementBodies } from '@festival/shared/metadata/announcementBodies'

definePageMeta({ layout: 'festival' })

const { address: festivalAddress, userRoles } = useFestivalContext()
const { canViewAnnouncements } = usePermissions(userRoles)

const {
  channel,
  channelCid,
  announcements,
  isLoading,
  isSending,
  txStatus,
  sendStep,
  error,
  loadChannel,
  sendAnnouncement,
} = useAnnouncements(festivalAddress)

const SEND_STEP_LABELS: Record<typeof sendStep.value, string> = {
  'idle': 'Send announcement',
  'saving': 'Saving announcement',
  'updating-channel': 'Updating channel',
  'sending': 'Sending broadcast',
}
const sendButtonLabel = computed(() => SEND_STEP_LABELS[sendStep.value])

const draft = ref('')
const charsLeft = computed(() => ANNOUNCEMENT_CONTENT_MAX_CHARS - draft.value.length)
const canSend = computed(() =>
  draft.value.trim().length > 0
  && draft.value.length <= ANNOUNCEMENT_CONTENT_MAX_CHARS
  && !isSending.value
  && !!channel.value,
)

// Announcement body cache, keyed by CID. `undefined` (key absent) = still
// being fetched; `null` = fetch failed (render fallback); body = loaded.
const bodies = ref<Map<string, AnnouncementBody | null>>(new Map())

async function ensureBodies(cids: string[]) {
  const missing = cids.filter((c) => !bodies.value.has(c))
  await fetchAnnouncementBodies(missing, (cid, body) => {
    bodies.value.set(cid, body)
  })
}

watch(announcements, (cids) => { void ensureBodies(cids) }, { immediate: true })

const reversed = computed(() => [...announcements.value].reverse())

async function onSend() {
  if (!canSend.value) return
  const content = draft.value.trim()
  try {
    await sendAnnouncement({ content })
    draft.value = ''
  } catch (e) {
    if (e instanceof ChannelConflictError) {
      // Pull in the conflicting state so the admin sees the new announcement(s)
      // before retrying. Keep the draft intact for re-send.
      await loadChannel()
    }
    // Otherwise error surfaces via the composable's `error` ref.
  }
}

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

onMounted(loadChannel)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-heading text-2xl font-bold" data-testid="announcements-heading">Announcements</h2>
    </div>

    <div v-if="!canViewAnnouncements" class="text-sm text-text-muted">
      You don't have permission to view announcements.
    </div>

    <div v-else-if="isLoading && !channel" class="text-sm text-text-muted py-6">
      Loading channel…
    </div>

    <div v-else-if="!channel" class="bg-surface border border-border rounded-xl p-6">
      <p class="text-sm text-text-secondary">
        This festival has no channel configured. Channels are created automatically during
        festival setup; if you're seeing this on a festival that should already have one,
        check that <code class="font-mono">channelMetadataCid</code> is non-zero on chain.
      </p>
    </div>

    <template v-else>
      <!-- Composer -->
      <div class="bg-surface border border-border rounded-xl p-4 mb-6">
        <label class="block text-xs text-text-muted mb-2">New announcement</label>
        <textarea
          v-model="draft"
          rows="3"
          :maxlength="ANNOUNCEMENT_CONTENT_MAX_CHARS"
          :disabled="isSending"
          placeholder="Doors open in 5 min…"
          class="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm resize-y disabled:cursor-not-allowed"
          data-testid="announcement-composer"
        />
        <div class="flex items-center justify-between mt-2">
          <span class="text-[11px] text-text-muted" :class="{ 'text-warning': charsLeft < 100, 'text-danger': charsLeft < 0 }">
            {{ charsLeft }} characters left
          </span>
          <button
            class="px-4 py-1.5 bg-primary text-black rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            :disabled="!canSend"
            data-testid="announcement-send-btn"
            @click="onSend"
          >
            <span
              v-if="isSending"
              class="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0"
              aria-hidden="true"
            />
            {{ sendButtonLabel }}
          </button>
        </div>
        <p v-if="error" class="text-xs text-danger mt-2">{{ error }}</p>
      </div>

      <!-- History -->
      <div class="space-y-2">
        <p v-if="!reversed.length" class="text-center text-text-muted text-sm py-8">
          No announcements sent yet.
        </p>
        <div
          v-for="cid in reversed"
          :key="cid"
          class="bg-surface border border-border rounded-xl p-4"
        >
          <template v-if="bodies.get(cid)">
            <p class="text-sm whitespace-pre-wrap break-words">{{ bodies.get(cid)!.content }}</p>
            <div class="flex items-center gap-2 mt-2 text-[11px] text-text-muted">
              <span>{{ formatTimestamp(bodies.get(cid)!.timestamp) }}</span>
              <span v-if="bodies.get(cid)!.senderName">· {{ bodies.get(cid)!.senderName }}</span>
            </div>
          </template>
          <p v-else-if="bodies.has(cid)" class="text-xs text-text-muted">
            Couldn't load announcement.
          </p>
          <div v-else class="space-y-2">
            <div class="h-3 bg-surface-2 rounded animate-pulse w-3/4" />
            <div class="h-3 bg-surface-2 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>

      <p v-if="reversed.length" class="text-xs text-text-muted mt-4">
        {{ reversed.length }} announcement{{ reversed.length === 1 ? '' : 's' }} · channel CID {{ channelCid?.slice(0, 10) }}…
      </p>
    </template>
  </div>
</template>
