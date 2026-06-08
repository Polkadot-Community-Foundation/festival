<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  modelValue: string
  sessionName: string
}>()

const emit = defineEmits<{
  'update:modelValue': [hex: string]
  done: []
}>()

const showEditor = ref(false)

function openEditor() {
  showEditor.value = true
}

function onEditorDone(hex: string) {
  emit('update:modelValue', hex)
  showEditor.value = false
  emit('done')
}

function onEditorClose() {
  showEditor.value = false
}

// If the user returns to this step with a badge already saved, jump straight
// back into the editor so they can tweak it. Closing the editor falls back
// to the intro, which acts as the universal re-entry point.
onMounted(() => {
  if (props.modelValue) showEditor.value = true
})
</script>

<template>
  <BadgeEditor
    v-if="showEditor"
    :model-value="modelValue || undefined"
    :title="sessionName"
    @done="onEditorDone"
    @close="onEditorClose"
  />

  <CreateBadgeIntro
    v-else
    @continue="openEditor"
  />
</template>
