<script setup lang="ts">
import { useFestivalCreate } from '~/composables/useFestivalCreate'

const {
  step, totalSteps, form, txStatus, error, createdAddress,
  festivalPoapImagePreview, setFestivalPoapImage,
  nextStep, prevStep, goToStep, submit, reset,
} = useFestivalCreate()

function onPoapImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  setFestivalPoapImage(input.files?.[0] ?? null)
}

function canProceed(): boolean {
  if (step.value === 1) return !!form.name && !!form.organizer
  if (step.value === 2) return !!form.venueName
  if (step.value === 3) return !!form.startDate && !!form.endDate
  return true
}
</script>

<template>
  <div class="max-w-2xl">
    <h2 class="font-heading text-2xl font-bold mb-2" data-testid="create-festival-heading">Create Festival</h2>
    <p class="text-text-secondary text-sm mb-6">Step {{ step }} of {{ totalSteps }}</p>

    <!-- Progress bar -->
    <div class="flex gap-1 mb-8">
      <div
        v-for="s in totalSteps"
        :key="s"
        class="h-1 flex-1 rounded-full transition-colors cursor-pointer"
        :class="s <= step ? 'bg-primary' : 'bg-border'"
        @click="s < step && goToStep(s)"
      />
    </div>

    <!-- Success state -->
    <div v-if="createdAddress" class="bg-success-muted rounded-xl p-6 text-center">
      <p class="text-lg font-medium text-success mb-2">Festival Created!</p>
      <p class="font-mono text-sm text-success break-all mb-4">{{ createdAddress }}</p>
      <div class="flex gap-3 justify-center">
        <NuxtLink
          :to="`/festival/${createdAddress}`"
          class="px-4 py-2 bg-primary text-black rounded-2xl text-sm hover:bg-primary-hover"
        >
          Go to Festival
        </NuxtLink>
        <button
          class="px-4 py-2 bg-secondary-btn rounded-2xl text-sm text-text-secondary hover:bg-secondary-btn-hover hover:text-text-primary"
          @click="reset"
        >
          Create Another
        </button>
      </div>
    </div>

    <!-- Form steps -->
    <div v-else>
      <!-- Step 1: Basic Info -->
      <div v-show="step === 1" class="space-y-4">
        <h3 class="font-medium text-lg mb-4">Basic Information</h3>

        <div>
          <label class="block text-sm font-medium mb-1">Festival Name *</label>
          <input
            v-model="form.name"
            type="text"
            class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary"
            placeholder="Web3 Summit 2026"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary resize-none"
            placeholder="Describe your festival…"
          />
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium mb-1">Organizer *</label>
            <input
              v-model="form.organizer"
              type="text"
              class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Website</label>
            <input
              v-model="form.website"
              type="url"
              class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary"
              placeholder="https://…"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Tags</label>
          <input
            v-model="form.tags"
            type="text"
            class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary"
            placeholder="web3, polkadot, conference (comma separated)"
          />
        </div>
      </div>

      <!-- Step 2: Location -->
      <div v-show="step === 2" class="space-y-4">
        <h3 class="font-medium text-lg mb-4">Location</h3>

        <div>
          <label class="block text-sm font-medium mb-1">Venue Name *</label>
          <input
            v-model="form.venueName"
            type="text"
            class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary"
            placeholder="Funkhaus Berlin"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Address</label>
          <input
            v-model="form.venueAddress"
            type="text"
            class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2 focus:outline-none focus:border-primary"
            placeholder="Nalepastraße 18, 12459 Berlin"
          />
        </div>
      </div>

      <!-- Step 3: Dates -->
      <div v-show="step === 3" class="space-y-4">
        <h3 class="font-medium text-lg mb-4">Dates & Times</h3>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium mb-1">Start Date *</label>
            <input v-model="form.startDate" type="date" class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Start Time</label>
            <input v-model="form.startTime" type="time" class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">End Date *</label>
            <input v-model="form.endDate" type="date" class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">End Time</label>
            <input v-model="form.endTime" type="time" class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2" />
          </div>
        </div>
      </div>

      <!-- Step 4: Capacity -->
      <div v-show="step === 4" class="space-y-4">
        <h3 class="font-medium text-lg mb-4">Capacity</h3>

        <div>
          <label class="block text-sm font-medium mb-1">Capacity</label>
          <input
            v-model.number="form.capacity"
            type="number"
            min="0"
            class="w-full px-3 py-2 border border-border rounded-xl text-sm bg-surface-2"
            placeholder="0 = unlimited"
          />
          <p class="text-xs text-text-muted mt-1">Set to 0 for unlimited capacity.</p>
        </div>
      </div>

      <!-- Step 5: Festival POAP Image -->
      <div v-show="step === 5" class="space-y-4">
        <h3 class="font-medium text-lg mb-4">Festival POAP Image</h3>

        <p class="text-sm text-text-secondary mb-4">
          Upload an image for the festival attendance POAP. This is the badge attendees receive when they check in.
        </p>

        <div>
          <label class="block text-sm font-medium mb-1">POAP Image</label>
          <input
            type="file"
            accept="image/*"
            class="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:bg-surface-2 file:text-text-primary hover:file:bg-border"
            @change="onPoapImageChange"
          />
          <p class="text-xs text-text-muted mt-1">Will be compressed to max 2000px JPEG. Optional.</p>
        </div>

        <div v-if="festivalPoapImagePreview" class="mt-4">
          <p class="text-sm font-medium mb-2">Preview</p>
          <img
            :src="festivalPoapImagePreview"
            alt="POAP preview"
            class="w-32 h-32 object-cover rounded-xl border border-border"
          />
        </div>
      </div>

      <!-- Step 6: Review -->
      <div v-show="step === 6" class="space-y-4">
        <h3 class="font-medium text-lg mb-4">Review & Submit</h3>

        <div class="bg-surface rounded-xl p-4 space-y-3 text-sm">
          <div class="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
            <span class="text-text-muted">Name</span>
            <span class="font-medium">{{ form.name }}</span>

            <span class="text-text-muted">Organizer</span>
            <span>{{ form.organizer }}</span>

            <span class="text-text-muted">Venue</span>
            <span>{{ form.venueName }}</span>

            <span class="text-text-muted">Dates</span>
            <span>{{ form.startDate }} – {{ form.endDate }}</span>

            <span class="text-text-muted">Capacity</span>
            <span>{{ form.capacity || 'Unlimited' }}</span>
          </div>
        </div>

        <!-- Transaction progress -->
        <div v-if="txStatus !== 'idle' && txStatus !== 'error'" class="bg-surface rounded-xl p-4 space-y-3">
          <div class="flex items-center gap-3">
            <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p class="text-sm font-medium">
                {{ txStatus === 'preparing' ? 'Saving metadata to Polkadot Cloud…' : '' }}
                {{ txStatus === 'signing' ? 'Waiting for your signature…' : '' }}
                {{ txStatus === 'broadcasting' ? 'Broadcasting transaction…' : '' }}
                {{ txStatus === 'in-block' ? 'Configuring festival on-chain…' : '' }}
                {{ txStatus === 'finalized' ? 'Done!' : '' }}
              </p>
              <p class="text-xs text-text-muted mt-0.5">
                {{ txStatus === 'preparing' ? 'Storing your festival details on the Polkadot Bulletin Chain' : '' }}
                {{ txStatus === 'signing' ? 'Approve the transaction in your wallet' : '' }}
                {{ txStatus === 'broadcasting' ? 'Sending your transaction to the network' : '' }}
                {{ txStatus === 'in-block' ? 'Transaction included in a block, waiting for confirmation' : '' }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="error" class="bg-danger-muted rounded-xl p-3 text-sm text-danger">
          {{ error }}
        </div>
      </div>

      <!-- Navigation -->
      <div class="flex items-center justify-between mt-8 pt-4 border-t border-border">
        <button
          v-if="step > 1"
          class="px-4 py-2 bg-secondary-btn rounded-2xl text-sm text-text-secondary hover:bg-secondary-btn-hover hover:text-text-primary transition-colors"
          @click="prevStep"
        >
          Back
        </button>
        <div v-else />

        <button
          v-if="step < totalSteps"
          class="px-4 py-2 bg-primary text-black rounded-2xl text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
          :disabled="!canProceed()"
          @click="nextStep"
        >
          Continue
        </button>
        <button
          v-else
          class="px-6 py-2 bg-primary text-black rounded-2xl text-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
          :disabled="txStatus === 'preparing' || txStatus === 'signing' || txStatus === 'broadcasting'"
          @click="submit"
        >
          {{ txStatus === 'idle' || txStatus === 'error' ? 'Create Festival' : 'Creating…' }}
        </button>
      </div>
    </div>
  </div>
</template>
