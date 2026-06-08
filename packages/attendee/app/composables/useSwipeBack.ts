import { ref, onMounted, onUnmounted, nextTick } from 'vue'

// --- Configuration ---
const EDGE_WIDTH = 28        // px from left edge to start gesture
const COMPLETE_RATIO = 0.35  // fraction of screen width to complete
const MIN_VELOCITY = 300     // px/s velocity that also completes

// Spring configs (stiffness, damping)
// Snap-back: slightly underdamped → subtle bounce
const SPRING_SNAP = { stiffness: 400, damping: 28 }
// Complete: critically damped → smooth exit, no bounce
const SPRING_COMPLETE = { stiffness: 300, damping: 35 }

// --- Spring animation ---

function animateSpring(
  from: number,
  to: number,
  initialVelocity: number,
  config: { stiffness: number; damping: number },
  onUpdate: (value: number) => void,
  onDone: () => void,
): () => void {
  let pos = from
  let vel = initialVelocity
  let raf: number
  let lastTime = performance.now()

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 1 / 30) // cap at ~30fps to avoid jumps
    lastTime = now

    const springForce = -config.stiffness * (pos - to)
    const dampForce = -config.damping * vel
    vel += (springForce + dampForce) * dt
    pos += vel * dt

    // Converged?
    if (Math.abs(pos - to) < 0.5 && Math.abs(vel) < 10) {
      onUpdate(to)
      onDone()
      return
    }

    // Clamp to prevent going past left edge (for snap-back)
    onUpdate(Math.max(0, pos))
    raf = requestAnimationFrame(tick)
  }

  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

// --- Composable ---

/**
 * Swipe-from-left-edge to navigate back, with spring physics.
 * Bind the returned `container` ref to the outermost layout element.
 */
export function useSwipeBack() {
  const router = useRouter()
  const route = useRoute()

  const container = ref<HTMLElement | null>(null)
  const offsetX = ref(0)
  const isGesturing = ref(false)

  let startX = 0
  let startY = 0
  let startTime = 0
  let locked: 'h' | 'v' | null = null
  let cancelAnim: (() => void) | null = null

  function canGoBack(): boolean {
    // Don't swipe back from home
    if (route.path === '/' || route.path === '') return false
    // Check Vue Router history state for a back entry
    return !!window.history.state?.back
  }

  function onTouchStart(e: TouchEvent) {
    if (!canGoBack()) return
    const t = e.touches[0]
    if (t.clientX > EDGE_WIDTH) return

    // Cancel any in-progress animation
    if (cancelAnim) { cancelAnim(); cancelAnim = null }

    startX = t.clientX
    startY = t.clientY
    startTime = Date.now()
    locked = null
    isGesturing.value = true
  }

  function onTouchMove(e: TouchEvent) {
    if (!isGesturing.value) return
    const t = e.touches[0]
    const dx = t.clientX - startX
    const dy = t.clientY - startY

    // Lock axis after small movement
    if (!locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      locked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
      if (locked === 'v') {
        isGesturing.value = false
        offsetX.value = 0
        return
      }
    }

    if (locked !== 'h') return
    e.preventDefault()
    offsetX.value = Math.max(0, dx)
  }

  function onTouchEnd() {
    if (!isGesturing.value) return
    isGesturing.value = false

    const w = window.innerWidth
    const ratio = offsetX.value / w
    const elapsed = Math.max(1, Date.now() - startTime)
    const velocityPxS = (offsetX.value / elapsed) * 1000

    const shouldComplete = ratio > COMPLETE_RATIO || (velocityPxS > MIN_VELOCITY && offsetX.value > 60)

    if (shouldComplete) {
      // Spring to full width, then navigate back
      cancelAnim = animateSpring(
        offsetX.value, w, velocityPxS,
        SPRING_COMPLETE,
        (v) => { offsetX.value = v },
        () => {
          cancelAnim = null
          router.back()
          nextTick(() => { offsetX.value = 0 })
        },
      )
    } else {
      // Spring back to origin
      cancelAnim = animateSpring(
        offsetX.value, 0, velocityPxS,
        SPRING_SNAP,
        (v) => { offsetX.value = v },
        () => { cancelAnim = null },
      )
    }
  }

  onMounted(() => {
    const el = container.value
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    if (cancelAnim) cancelAnim()
    const el = container.value
    if (!el) return
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
  })

  return { container, offsetX, isGesturing }
}
