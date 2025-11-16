<template>
  <Slider
    :modelValue="innerValue"
    v-bind="$attrs"
    @update:modelValue="onInnerUpdate"
    @change="onInnerChange"
    @slideend="onInnerSlideEnd"
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import Slider from 'primevue/slider'

const props = defineProps({
  modelValue: { type: null, default: undefined },
  debounce: { type: Number, default: 200 }
})

const emit = defineEmits(['update:modelValue', 'change', 'slideend'])

const innerValue = ref(props.modelValue)
watch(() => props.modelValue, (v) => { innerValue.value = v })

let updateTimer = null
let changeTimer = null

const onInnerUpdate = (value) => {
  innerValue.value = value
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    emit('update:modelValue', value)
  }, props.debounce)
}

const onInnerChange = (value) => {
  if (changeTimer) clearTimeout(changeTimer)
  changeTimer = setTimeout(() => {
    emit('change', value)
  }, props.debounce)
}

const onInnerSlideEnd = (event) => {
  emit('slideend', event)
}
</script>