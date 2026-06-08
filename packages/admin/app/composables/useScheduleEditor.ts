import { ref, computed } from 'vue'
import type { ScheduleEntry, VenueMarker } from '@festival/shared/metadata/schemas'
import { parseFestivalDate } from '@festival/shared/utils/time'

let idCounter = 100

function generateId(): string {
  return `entry-${Date.now()}-${idCounter++}`
}

export function useScheduleEditor(
  initialEntries: ScheduleEntry[] = [],
  availableMarkers: VenueMarker[] = [],
) {
  const entries = ref<ScheduleEntry[]>([...initialEntries])
  const markers = ref<VenueMarker[]>(availableMarkers)
  const editingEntry = ref<ScheduleEntry | null>(null)
  const showForm = ref(false)
  const isDirty = ref(false)

  const sorted = computed(() =>
    [...entries.value].sort((a, b) => parseFestivalDate(a.start).getTime() - parseFestivalDate(b.start).getTime()),
  )

  function openAdd() {
    editingEntry.value = {
      id: generateId(),
      start: '',
      end: '',
      title: '',
      description: '',
      speakers: [],
      venueMarkerId: undefined,
    }
    showForm.value = true
  }

  function openEdit(entry: ScheduleEntry) {
    editingEntry.value = { ...entry, speakers: [...entry.speakers] }
    showForm.value = true
  }

  function saveEntry(entry: ScheduleEntry) {
    const idx = entries.value.findIndex(e => e.id === entry.id)
    if (idx >= 0) {
      entries.value[idx] = { ...entry }
    } else {
      entries.value.push({ ...entry })
    }
    showForm.value = false
    editingEntry.value = null
    isDirty.value = true
  }

  function removeEntry(id: string) {
    entries.value = entries.value.filter(e => e.id !== id)
    isDirty.value = true
  }

  function moveUp(id: string) {
    const idx = entries.value.findIndex(e => e.id === id)
    if (idx > 0) {
      const temp = entries.value[idx]
      entries.value[idx] = entries.value[idx - 1]
      entries.value[idx - 1] = temp
      isDirty.value = true
    }
  }

  function moveDown(id: string) {
    const idx = entries.value.findIndex(e => e.id === id)
    if (idx < entries.value.length - 1) {
      const temp = entries.value[idx]
      entries.value[idx] = entries.value[idx + 1]
      entries.value[idx + 1] = temp
      isDirty.value = true
    }
  }

  function cancelEdit() {
    showForm.value = false
    editingEntry.value = null
  }

  return {
    entries,
    sorted,
    markers,
    editingEntry,
    showForm,
    isDirty,
    openAdd,
    openEdit,
    saveEntry,
    removeEntry,
    moveUp,
    moveDown,
    cancelEdit,
  }
}
