<script setup lang="ts">
import { computed } from 'vue'
import type { VenueFloor } from '@festival/shared/metadata/schemas'
import { FLOOR_SELECTOR_SVG } from '@festival/shared/venue/icons'

const props = defineProps<{
  floors: VenueFloor[]
  activeFloorId: string
}>()

const emit = defineEmits<{
  change: [floorId: string]
}>()

// For 2-floor blocks: show a single toggle button with the OTHER floor's label.
// For 3+ floors: show a pill stack.
const otherFloor = computed<VenueFloor | null>(() => {
  if (props.floors.length !== 2) return null
  return props.floors.find(f => f.id !== props.activeFloorId) ?? null
})

function handleToggleClick() {
  const next = otherFloor.value
  if (next) emit('change', next.id)
}
</script>

<template>
  <!-- Single-floor blocks: no control rendered. -->
  <template v-if="floors.length <= 1" />

  <!-- Two-floor toggle: button with other floor's glyph + name. -->
  <button
    v-else-if="otherFloor"
    type="button"
    class="floor-control floor-control--toggle"
    data-testid="floor-control"
    :aria-label="`Switch to ${otherFloor.label}`"
    @click.stop="handleToggleClick"
  >
    <span class="floor-control__glyph" aria-hidden="true" v-html="FLOOR_SELECTOR_SVG" />
    <span class="floor-control__label">{{ otherFloor.label }}</span>
  </button>

  <!-- 3+ floors: pill stack. -->
  <div v-else class="floor-control floor-control--stack" role="tablist" data-testid="floor-control">
    <button
      v-for="floor in floors"
      :key="floor.id"
      type="button"
      role="tab"
      :aria-selected="floor.id === activeFloorId"
      :data-testid="`floor-control-pill-${floor.id}`"
      :class="['floor-control__pill', { 'is-active': floor.id === activeFloorId }]"
      @click.stop="emit('change', floor.id)"
    >
      {{ floor.label }}
    </button>
  </div>
</template>

<style scoped>
.floor-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  padding: 0;
  font-family: inherit;
  color: inherit;
  cursor: pointer;
}

.floor-control--toggle {
  /* Glyph button with adjacent label. */
  gap: 8px;
}

.floor-control__glyph {
  width: 40px;
  height: 40px;
  display: inline-block;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 120ms ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.floor-control__glyph :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.floor-control--toggle:hover .floor-control__glyph { transform: scale(1.05); }
.floor-control--toggle:active .floor-control__glyph { transform: scale(0.97); }

.floor-control__label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
}

.floor-control--stack {
  flex-direction: column;
  padding: 4px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.floor-control__pill {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  color: #3a3a3a;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background 150ms, color 150ms;
}
.floor-control__pill.is-active {
  background: #0f0f0f;
  color: #ffffff;
}
</style>
