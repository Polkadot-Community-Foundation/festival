<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  GRID_SIZE, PIXEL_COUNT, PALETTE,
  encodeBadgeHex, decodeBadgeHex, generateBadge,
  type EditorTool,
} from '@festival/shared/utils/badge'

const props = defineProps<{
  modelValue?: string
  title?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [hex: string]
}>()

// ── State ──

const backgroundColorIndex = ref(Math.floor(Math.random() * PALETTE.length))
const pixels = ref<number[]>(new Array(PIXEL_COUNT).fill(backgroundColorIndex.value))
const selectedColor = ref(backgroundColorIndex.value === 0 ? 1 : 0)
const activeTool = ref<EditorTool>('pencil')
const isDragging = ref(false)

// Initialize from existing badge or random fill
if (props.modelValue) {
  pixels.value = decodeBadgeHex(props.modelValue)
} else {
  pixels.value = generateBadge(props.title || 'badge', undefined)
  emitHex()
}

// ── Undo ──

const undoStack = ref<number[][]>([])
const canUndo = computed(() => undoStack.value.length > 0)

function pushUndo() {
  undoStack.value.push([...pixels.value])
  if (undoStack.value.length > 20) undoStack.value.shift()
}

function undo() {
  if (!canUndo.value) return
  pixels.value = undoStack.value.pop()!
  emitHex()
}

// ── Painting ──

const gridRef = ref<HTMLElement | null>(null)

function getIndexFromEvent(e: MouseEvent | Touch): number {
  const el = gridRef.value
  if (!el) return -1
  const rect = el.getBoundingClientRect()
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * GRID_SIZE)
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * GRID_SIZE)
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return -1
  return y * GRID_SIZE + x
}

function paintAt(idx: number) {
  if (idx < 0 || idx >= PIXEL_COUNT) return
  pixels.value[idx] = activeTool.value === 'eraser' ? backgroundColorIndex.value : selectedColor.value
  pixels.value = [...pixels.value]
  emitHex()
}

function floodFill(startIdx: number) {
  if (startIdx < 0 || startIdx >= PIXEL_COUNT) return
  const target = pixels.value[startIdx]
  const fill = activeTool.value === 'eraser' ? backgroundColorIndex.value : selectedColor.value
  if (target === fill) return
  pushUndo()
  const visited = new Set<number>()
  const stack = [startIdx]
  while (stack.length) {
    const idx = stack.pop()!
    if (visited.has(idx) || pixels.value[idx] !== target) continue
    visited.add(idx)
    pixels.value[idx] = fill
    const x = idx % GRID_SIZE, y = Math.floor(idx / GRID_SIZE)
    if (x > 0) stack.push(idx - 1)
    if (x < GRID_SIZE - 1) stack.push(idx + 1)
    if (y > 0) stack.push(idx - GRID_SIZE)
    if (y < GRID_SIZE - 1) stack.push(idx + GRID_SIZE)
  }
  pixels.value = [...pixels.value]
  emitHex()
}

function handlePointerDown(e: MouseEvent) {
  const idx = getIndexFromEvent(e)
  if (idx < 0) return
  if (activeTool.value === 'fill') { floodFill(idx); return }
  isDragging.value = true
  pushUndo()
  paintAt(idx)
}

function handlePointerMove(e: MouseEvent) {
  if (isDragging.value) {
    const idx = getIndexFromEvent(e)
    if (idx >= 0) paintAt(idx)
  }
}

function handlePointerUp() { isDragging.value = false }

function handleTouchStart(e: TouchEvent) {
  e.preventDefault()
  const t = e.touches[0]; if (!t) return
  const idx = getIndexFromEvent(t)
  if (idx < 0) return
  if (activeTool.value === 'fill') { floodFill(idx); return }
  isDragging.value = true
  pushUndo()
  paintAt(idx)
}

function handleTouchMove(e: TouchEvent) {
  e.preventDefault()
  const t = e.touches[0]; if (!t || !isDragging.value) return
  const idx = getIndexFromEvent(t)
  if (idx >= 0) paintAt(idx)
}

function handleTouchEnd(e: TouchEvent) { e.preventDefault(); isDragging.value = false }

onMounted(() => { window.addEventListener('mouseup', handlePointerUp) })
onUnmounted(() => { window.removeEventListener('mouseup', handlePointerUp) })

function randomize() {
  pushUndo()
  pixels.value = generateBadge(props.title || 'badge', undefined, Math.random().toString(36).slice(2))
  emitHex()
}

function emitHex() { emit('update:modelValue', encodeBadgeHex(pixels.value)) }

const gridBgColor = computed(() => PALETTE[backgroundColorIndex.value] + '80')

const toolLabel = computed(() => {
  const labels: Record<EditorTool, string> = { pencil: 'PENCIL SELECTED', fill: 'FILL SELECTED', eraser: 'ERASER SELECTED' }
  return labels[activeTool.value]
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Top row: Undo + Randomize -->
    <div class="flex items-center justify-between">
      <button
        class="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center transition-opacity"
        :class="{ 'opacity-30': !canUndo }"
        :disabled="!canUndo"
        @click="undo"
      >
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M16.62 10.67c-3.53 0-6.73 1.32-9.2 3.46l-2.52-2.52c-.84-.84-2.28-.25-2.28.94v7.45c0 .73.6 1.33 1.33 1.33h7.45c1.19 0 1.79-1.44.95-2.28l-2.55-2.55c1.85-1.55 4.21-2.51 6.83-2.51 4.21 0 7.85 2.45 9.59 6 .36.75 1.21 1.12 2 .85.95-.3 1.43-1.38 1-2.29-2.29-4.67-7.07-7.89-12.6-7.89Z" fill="white"/></svg>
      </button>
      <button
        class="px-4 h-10 rounded-full bg-surface-2 text-white text-sm font-medium"
        @click="randomize"
      >
        Random
      </button>
    </div>

    <!-- Canvas -->
    <div
      ref="gridRef"
      class="grid w-full select-none rounded-lg overflow-hidden"
      :style="{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        gap: '1px',
        background: gridBgColor,
        cursor: 'crosshair',
        touchAction: 'none',
      }"
      @mousedown="handlePointerDown"
      @mousemove="handlePointerMove"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <div
        v-for="i in PIXEL_COUNT"
        :key="i - 1"
        class="aspect-square"
        :style="{ backgroundColor: PALETTE[pixels[i - 1]] }"
      />
    </div>

    <!-- Palette -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="(color, idx) in PALETTE"
        :key="idx"
        class="w-7 h-7 rounded-full border-2 transition-transform"
        :class="selectedColor === idx ? 'scale-110 border-white shadow-md' : 'border-transparent'"
        :style="{ backgroundColor: color }"
        @click="selectedColor = idx; if (activeTool === 'eraser') activeTool = 'pencil'"
      />
    </div>

    <!-- Tool label -->
    <p class="text-center text-[10px] font-semibold text-text-secondary tracking-widest">
      {{ toolLabel }}
    </p>

    <!-- Bottom toolbar -->
    <div class="flex items-center justify-center gap-4">
      <!-- Pencil -->
      <button
        class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
        :class="activeTool === 'pencil' ? 'bg-white' : 'bg-surface-2'"
        @click="activeTool = 'pencil'"
      >
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M4 23.28v4.05c0 .37.29.67.66.67h4.05c.17 0 .35-.07.47-.2L23.75 13.25l-5-5L4.2 22.8a.65.65 0 0 0-.2.48Zm23.61-13.89a1.33 1.33 0 0 0 0-1.88l-3.12-3.12a1.33 1.33 0 0 0-1.88 0l-2.44 2.44 5 5 2.44-2.44Z" :fill="activeTool === 'pencil' ? 'black' : 'white'"/></svg>
      </button>
      <!-- Fill -->
      <button
        class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
        :class="activeTool === 'fill' ? 'bg-white' : 'bg-surface-2'"
        @click="activeTool = 'fill'"
      >
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M23.33 5.33V4c0-.73-.6-1.33-1.33-1.33H6c-.73 0-1.33.6-1.33 1.33v5.33c0 .74.6 1.34 1.33 1.34h16c.73 0 1.33-.6 1.33-1.34V8h1.34v5.33H12.67c-.74 0-1.34.6-1.34 1.34V28c0 .73.6 1.33 1.34 1.33h2.66c.74 0 1.34-.6 1.34-1.33V16h9.33c.73 0 1.33-.6 1.33-1.33V6.67c0-.74-.6-1.34-1.33-1.34h-2.67Z" :fill="activeTool === 'fill' ? 'black' : 'white'"/></svg>
      </button>
      <!-- Eraser -->
      <button
        class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
        :class="activeTool === 'eraser' ? 'bg-white' : 'bg-surface-2'"
        @click="activeTool = 'eraser'"
      >
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M17.89 4.69 4.69 17.88a2.67 2.67 0 0 0 0 3.77l5.65 5.66a2.67 2.67 0 0 0 3.77 0L27.31 14.11a2.67 2.67 0 0 0 0-3.77l-5.66-5.66a2.67 2.67 0 0 0-3.77 0Zm7.54 7.54L12.23 25.43l-5.66-5.66L19.77 6.57l5.66 5.66Z" :fill="activeTool === 'eraser' ? 'black' : 'white'"/><path d="M10.98 11.59 3.82 18.75c-.56.56-.17 1.87.87 2.91l5.66 5.66c1.04 1.04 2.35 1.43 2.91.87l7.15-7.16c.56-.56.17-1.87-.87-2.91l-5.66-5.66c-1.03-1.04-2.34-1.43-2.9-.87Z" :fill="activeTool === 'eraser' ? 'black' : 'white'"/></svg>
      </button>
    </div>
  </div>
</template>
