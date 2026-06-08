/**
 * 3D badge card physics. Drag, flick, drift, shine.
 * Pure DOM manipulation, no framework dependency.
 */

export interface Badge3DOptions {
  /** The outer perspective container (touch-action: none) */
  stage: HTMLElement
  /** The inner transform-style: preserve-3d element */
  badge: HTMLElement
  /** The shine overlay div (radial gradient) */
  shine?: HTMLElement | null
  /** Initial rotation */
  initialRotX?: number
  initialRotY?: number
  /** Idle drift speed in deg/frame (default 0.25) */
  idleSpeed?: number
}

export interface Badge3DInstance {
  destroy: () => void
  reset: () => void
}

export function createBadge3D(options: Badge3DOptions): Badge3DInstance {
  const {
    stage, badge,
    shine = null,
    initialRotX = -8,
    initialRotY = 18,
    idleSpeed = 0.25,
  } = options

  let rotX = initialRotX
  let rotY = initialRotY
  let driftX = 0
  let driftY = idleSpeed
  let velX = 0
  let velY = 0
  let targetX = rotX
  let targetY = rotY
  let dragging = false
  let lastX = 0
  let lastY = 0
  let lastT = 0
  let rafId: number | null = null

  function applyTransform() {
    badge.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`
    if (shine) {
      const sx = 30 + rotY * 0.8
      const sy = 20 - rotX * 0.8
      shine.style.background = `radial-gradient(circle 180px at ${sx}% ${sy}%, rgba(255,255,255,0.5), rgba(255,255,255,0.15) 35%, transparent 60%)`
    }
  }

  function tick() {
    if (dragging) {
      rotX += (targetX - rotX) * 0.35
      rotY += (targetY - rotY) * 0.35
    } else {
      rotX += driftX + velX
      rotY += driftY + velY
      velX *= 0.95
      velY *= 0.95
    }
    applyTransform()
    rafId = requestAnimationFrame(tick)
  }

  function onDown(e: MouseEvent | TouchEvent) {
    dragging = true
    stage.style.cursor = 'grabbing'
    const p = 'touches' in e ? e.touches[0] : e
    lastX = p.clientX
    lastY = p.clientY
    lastT = performance.now()
    velX = 0
    velY = 0
    targetX = rotX
    targetY = rotY
    e.preventDefault()
  }

  function onMove(e: MouseEvent | TouchEvent) {
    if (!dragging) return
    const p = 'touches' in e ? e.touches[0] : e
    const now = performance.now()
    const dx = p.clientX - lastX
    const dy = p.clientY - lastY
    const dt = Math.max(1, now - lastT)
    targetY += dx * 0.5
    targetX -= dy * 0.5
    if (targetX > 75) targetX = 75
    if (targetX < -75) targetX = -75
    velY = (dx * 0.5) / dt * 16
    velX = (-dy * 0.5) / dt * 16
    lastX = p.clientX
    lastY = p.clientY
    lastT = now
    e.preventDefault()
  }

  function onUp() {
    if (!dragging) return
    dragging = false
    stage.style.cursor = 'grab'
    // Determine dominant flick direction for new drift
    let dirX = 0
    let dirY = 0
    if (Math.abs(velY) >= Math.abs(velX)) dirY = velY >= 0 ? 1 : -1
    else dirX = velX >= 0 ? 1 : -1
    if (Math.abs(velX) >= 0.3 || Math.abs(velY) >= 0.3) {
      driftX = dirX * idleSpeed
      driftY = dirY * idleSpeed
    }
    const cap = 6
    velX = Math.max(-cap, Math.min(cap, velX)) - driftX
    velY = Math.max(-cap, Math.min(cap, velY)) - driftY
  }

  function onDouble() {
    velX = 0
    velY = 0
    rotX = initialRotX
    rotY = initialRotY
    targetX = rotX
    targetY = rotY
    driftX = 0
    driftY = idleSpeed
  }

  // Attach listeners
  stage.addEventListener('mousedown', onDown)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  stage.addEventListener('touchstart', onDown, { passive: false })
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onUp)
  stage.addEventListener('dblclick', onDouble)

  // Start animation
  applyTransform()
  rafId = requestAnimationFrame(tick)

  function destroy() {
    if (rafId !== null) cancelAnimationFrame(rafId)
    stage.removeEventListener('mousedown', onDown)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    stage.removeEventListener('touchstart', onDown)
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onUp)
    stage.removeEventListener('dblclick', onDouble)
  }

  function reset() {
    onDouble()
  }

  return { destroy, reset }
}

/**
 * Generate edge slab colors by interpolating between front and back colors.
 * Returns CSS background strings for each slab.
 */
export function generateEdgeColors(
  frontRgb: [number, number, number],
  backRgb: [number, number, number],
  layers: number,
): string[] {
  const colors: string[] = []
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1)
    const r = Math.round(frontRgb[0] + (backRgb[0] - frontRgb[0]) * t)
    const g = Math.round(frontRgb[1] + (backRgb[1] - frontRgb[1]) * t)
    const b = Math.round(frontRgb[2] + (backRgb[2] - frontRgb[2]) * t)
    colors.push(`rgb(${r},${g},${b})`)
  }
  return colors
}

/**
 * Convert a hex color to RGB tuple.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/**
 * Darken an RGB color by a factor (0-1, where 0 = black, 1 = unchanged).
 */
export function darkenRgb(rgb: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.round(rgb[0] * factor),
    Math.round(rgb[1] * factor),
    Math.round(rgb[2] * factor),
  ]
}
