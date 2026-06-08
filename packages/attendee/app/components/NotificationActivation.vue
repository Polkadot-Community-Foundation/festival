<script setup lang="ts">
// Announcements are delivered through the host's Chat, so these steps point at
// the host menu — the app can't toggle them itself. Used by both the post-claim
// overlay and the help page; callers supply the surrounding chrome.

const steps = [
  { icon: '/three-dots-icon.svg', before: 'Tap the', after: 'menu in the top right' },
  { icon: '/message_icon.svg', before: 'Open', after: '"Chat" from the menu' },
  { icon: '/bell-quiet.svg', before: 'Notifications', after: 'are now active' },
]
</script>

<template>
  <div class="flex flex-col text-center" data-testid="notification-activation">
    <h2 class="mt-2 px-2 text-[32px] font-semibold leading-[38px] text-white">
      Don't miss out on<br />anything!
    </h2>

    <img
      src="/Announcements-chat.svg"
      alt=""
      class="mx-auto mt-10 w-full max-w-[340px]"
    />

    <p class="mx-auto mt-7 max-w-[300px] text-base leading-snug text-white/70">
      Turn on notifications to stay updated on announcements, agenda, and
      program changes.
    </p>

    <!-- Pushes the card toward the bottom; collapses on short viewports. -->
    <div class="min-h-8 flex-1" aria-hidden="true" />

    <div class="rounded-2xl border border-white/10 bg-surface-2 p-4 text-left">
      <p class="text-sm font-semibold uppercase tracking-wide text-white/70">
        How to activate
      </p>
      <ol class="mt-3 space-y-3">
        <li
          v-for="(step, i) in steps"
          :key="i"
          class="flex items-center gap-2 text-base leading-snug text-white"
        >
          <span class="shrink-0 text-white/40">{{ i + 1 }}.</span>
          <span>
            {{ step.before }}
            <img :src="step.icon" alt="" class="inline-block h-6 w-6 align-middle mx-0.5" />
            {{ step.after }}
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>
