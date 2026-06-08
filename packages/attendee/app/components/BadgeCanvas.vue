<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { GRID_SIZE, PALETTE } from '@festival/shared/utils/badge'

const props = withDefaults(defineProps<{
  pixels: number[]
  size?: number
}>(), { size: 64 })

const canvasRef = ref<HTMLCanvasElement | null>(null)

function render() {
  const canvas = canvasRef.value
  if (!canvas) return

  const scale = Math.ceil(props.size / GRID_SIZE)
  canvas.width = GRID_SIZE * scale
  canvas.height = GRID_SIZE * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < props.pixels.length; i++) {
    const colorIdx = props.pixels[i]
    if (colorIdx == null) continue

    const color = PALETTE[colorIdx]
    if (!color) continue

    const x = i % GRID_SIZE
    const y = Math.floor(i / GRID_SIZE)

    ctx.fillStyle = color
    ctx.fillRect(x * scale, y * scale, scale, scale)
  }
}

onMounted(render)
watch(() => props.pixels, render, { deep: true })
watch(() => props.size, render)
</script>

<template>
  <canvas
    ref="canvasRef"
    class="block w-full h-full"
    style="image-rendering: pixelated"
  />
</template>
