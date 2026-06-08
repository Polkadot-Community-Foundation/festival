<script setup lang="ts">
import { ref } from 'vue'
import { useCheckIn } from '~/composables/useCheckIn'
import { shortenAddress } from '@festival/shared/utils/address'

definePageMeta({ layout: 'festival' })

const route = useRoute()
const {
  step,
  attendeeSS58,
  accountStatus,
  errorSource,
  txStatus,
  error,
  recentCheckins,
  reset,
  startScanningAccount,
  handleAccountScan,
  executeCheckIn,
  manualCheckInOnly,
} = useCheckIn(route.params.address as string)

// Manual fallback
const manualAddress = ref('')
const manualError = ref('')
const manualExpanded = ref(false)
const manualScanning = ref(false)

async function handleManualCheckIn() {
  if (!manualAddress.value) return
  manualError.value = ''
  try {
    await manualCheckInOnly(manualAddress.value)
    manualAddress.value = ''
  } catch (e: any) {
    manualError.value = e.message
  }
}

function onManualScan(data: string) {
  manualScanning.value = false
  manualAddress.value = data.trim()
}

function onAccountScan(data: string) {
  handleAccountScan(data)
}
</script>

<template>
  <div>
    <h2 class="font-heading text-2xl font-bold mb-6" data-testid="checkin-heading">Check-In</h2>

    <!-- QR Flow -->
    <div class="bg-surface rounded-xl p-5 mb-4">

      <!-- Persistent: Account summary (shown once validated) -->
      <div
        v-if="attendeeSS58 && accountStatus && (step === 'confirming' || step === 'executing' || step === 'success' || (step === 'error' && errorSource === 'transaction'))"
        class="bg-violet/12 rounded-xl p-3 mb-4"
      >
        <p class="text-sm text-violet font-medium">Account verified</p>
        <div class="text-xs text-violet mt-1 space-y-0.5">
          <p>Address: <span class="font-mono">{{ shortenAddress(attendeeSS58) }}</span></p>
          <p>{{ accountStatus.registered ? 'Registered, not yet checked in' : 'New attendee' }}</p>
        </div>
      </div>

      <!-- Step: Idle -->
      <div v-if="step === 'idle'" class="text-center py-8" data-testid="checkin-idle">
        <p class="text-sm text-text-muted mb-4">Scan an attendee's account QR to check them in</p>
        <button
          class="px-6 py-3 bg-primary text-black rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors"
          data-testid="checkin-scan-account-btn"
          @click="startScanningAccount"
        >
          Scan Account QR
        </button>
      </div>

      <!-- Step: Scanning Account -->
      <div v-else-if="step === 'scanning-account'" class="space-y-3">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-medium">Scan account QR</p>
          <button
            class="text-xs text-text-muted hover:text-text-primary transition-colors"
            @click="reset"
          >
            Cancel
          </button>
        </div>

        <QRScanner :active="true" @scan="onAccountScan" />

        <p v-if="error" class="text-xs text-danger">{{ error }}</p>
      </div>

      <!-- Step: Validating Account -->
      <div v-else-if="step === 'validating-account'" class="text-center py-4">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p class="text-sm text-text-muted">Checking account...</p>
      </div>

      <!-- Step: Confirming -->
      <div v-else-if="step === 'confirming'" class="space-y-4">
        <p class="text-sm font-medium">Confirm check-in</p>

        <p class="text-xs text-text-muted">
          This will check in the attendee on the festival contract and mint their POAP.
        </p>

        <div class="flex gap-2">
          <button
            class="flex-1 px-4 py-2 bg-secondary-btn rounded-2xl text-sm text-text-secondary hover:bg-secondary-btn-hover hover:text-text-primary transition-colors"
            @click="reset"
          >
            Cancel
          </button>
          <button
            class="flex-1 px-4 py-2 bg-primary text-black rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors"
            @click="executeCheckIn"
          >
            Confirm Check-In
          </button>
        </div>
      </div>

      <!-- Step: Executing -->
      <div v-else-if="step === 'executing'" class="text-center py-4">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p class="text-sm text-text-muted">Processing check-in...</p>
      </div>

      <!-- Step: Success -->
      <div v-else-if="step === 'success'" class="space-y-4 text-center py-4">
        <div class="w-12 h-12 rounded-full bg-success/12 flex items-center justify-center mx-auto">
          <span class="text-success text-lg">&#10003;</span>
        </div>
        <p class="text-sm font-medium">Check-in complete</p>
        <button
          class="px-6 py-2 bg-primary text-black rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors"
          @click="reset"
        >
          Next Check-In
        </button>
      </div>

      <!-- Step: Error -->
      <div v-else-if="step === 'error'" class="space-y-4">
        <div class="bg-danger-muted rounded-xl p-3">
          <p class="text-sm text-danger font-medium">{{ errorSource === 'account' ? 'Account validation failed' : errorSource === 'transaction' ? 'Check-in failed' : 'Error' }}</p>
          <p class="text-xs text-danger mt-1">{{ error }}</p>
        </div>
        <div class="flex gap-2">
          <button
            class="flex-1 px-4 py-2 bg-secondary-btn rounded-2xl text-sm text-text-secondary hover:bg-secondary-btn-hover hover:text-text-primary transition-colors"
            @click="reset"
          >
            Start Over
          </button>
          <button
            v-if="errorSource === 'account'"
            class="flex-1 px-4 py-2 bg-primary text-black rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors"
            @click="startScanningAccount"
          >
            Scan Another Account
          </button>
          <button
            v-else-if="errorSource === 'transaction'"
            class="flex-1 px-4 py-2 bg-primary text-black rounded-2xl text-sm font-medium hover:bg-primary-hover transition-colors"
            @click="executeCheckIn"
          >
            Retry Transaction
          </button>
        </div>
      </div>
    </div>

    <!-- Manual fallback (collapsible) -->
    <div class="border border-border rounded-xl">
      <button
        class="w-full px-4 py-3 flex items-center justify-between text-sm text-text-muted hover:bg-surface transition-colors rounded-xl"
        data-testid="manual-entry-toggle"
        @click="manualExpanded = !manualExpanded"
      >
        <span>Manual Entry</span>
        <span class="text-xs">{{ manualExpanded ? '−' : '+' }}</span>
      </button>

      <div v-if="manualExpanded" class="px-4 pb-4">
        <p class="text-xs text-text-muted mb-3">
          Check in by address. Registers + checks in + mints POAP.
        </p>

        <QRScanner v-if="manualScanning" :active="true" @scan="onManualScan" class="mb-3" />

        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="manualAddress"
            type="text"
            placeholder="5Grwva... or 0x..."
            class="flex-1 px-3 py-2 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary font-mono"
            data-testid="manual-address-input"
            @keyup.enter="handleManualCheckIn"
          />
          <button
            class="px-4 py-2 bg-secondary-btn rounded-2xl text-sm text-text-secondary hover:bg-secondary-btn-hover hover:text-text-primary transition-colors whitespace-nowrap"
            @click="manualScanning = !manualScanning"
          >
            {{ manualScanning ? 'Cancel Scan' : 'Scan QR' }}
          </button>
          <button
            class="px-4 py-2 bg-primary text-black rounded-2xl text-sm hover:bg-primary-hover transition-colors whitespace-nowrap disabled:opacity-50"
            data-testid="manual-checkin-btn"
            :disabled="!manualAddress || txStatus === 'preparing'"
            @click="handleManualCheckIn"
          >
            {{ txStatus === 'preparing' ? 'Checking in...' : 'Check In' }}
          </button>
        </div>
        <p v-if="manualError" class="text-xs text-danger mt-2">{{ manualError }}</p>
      </div>
    </div>

    <!-- Recent check-ins -->
    <div class="mt-6">
      <h3 class="text-sm font-medium mb-3">Recent Check-Ins</h3>
      <div v-if="recentCheckins.length" class="bg-surface rounded-xl divide-y divide-border">
        <div
          v-for="(checkin, i) in recentCheckins"
          :key="i"
          class="px-4 py-3 flex flex-wrap gap-y-1 items-center justify-between"
        >
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
              :class="checkin.method === 'qr' ? 'bg-violet/12 text-violet' : 'bg-surface-2 text-text-muted'"
            >
              {{ checkin.method === 'qr' ? 'QR' : 'Manual' }}
            </span>
            <span class="text-sm truncate">{{ checkin.name }}</span>
            <span class="hidden sm:inline text-xs text-text-muted font-mono truncate">{{ checkin.address }}</span>
          </div>
          <span class="text-xs text-text-muted whitespace-nowrap shrink-0">{{ checkin.time }}</span>
        </div>
      </div>
      <p v-else class="text-text-muted text-sm">No check-ins yet.</p>
    </div>
  </div>
</template>
