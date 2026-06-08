import { ref, onMounted, onBeforeUnmount } from 'vue'

const TICK_MS = 30_000

const sharedNow = ref(new Date())
let refCount = 0
let timer: ReturnType<typeof setInterval> | null = null

export function useNow() {
  onMounted(() => {
    refCount += 1
    if (timer == null) {
      timer = setInterval(() => {
        sharedNow.value = new Date()
      }, TICK_MS)
    }
  })

  onBeforeUnmount(() => {
    refCount -= 1
    if (refCount <= 0 && timer != null) {
      clearInterval(timer)
      timer = null
      refCount = 0
    }
  })

  return sharedNow
}
