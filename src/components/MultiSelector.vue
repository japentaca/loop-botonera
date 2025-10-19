<template>
  <div class="multi-selector">
    <label v-if="label" class="selector-label">{{ label }}</label>
    <div ref="selectorRef" class="selector-container" :class="{ active: isOpen }">
      <div class="selector-header" @click="toggleDropdown" :class="{ active: isOpen }">
        <span class="selected-text">{{ selectedText }}</span>
        <span class="dropdown-arrow" :class="{ rotated: isOpen }">▼</span>
      </div>
      
      <Teleport to="body">
        <div v-if="isOpen" ref="dropdownRef" class="selector-dropdown">
          <div 
            v-for="option in options" 
            :key="option.value"
            class="selector-option"
            :class="{ selected: isSelected(option.value) }"
            @click="toggleOption(option.value)"
          >
            <span class="option-checkbox">
              {{ isSelected(option.value) ? '✓' : '' }}
            </span>
            <span class="option-label">{{ option.label }}</span>
            <span v-if="option.description" class="option-description">{{ option.description }}</span>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  options: {
    type: Array,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Seleccionar opciones...'
  },
  maxSelections: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const selectorRef = ref(null)
const dropdownRef = ref(null)

const selectedText = computed(() => {
  if (props.modelValue.length === 0) {
    return props.placeholder
  }
  
  if (props.modelValue.length === 1) {
    const option = props.options.find(opt => opt.value === props.modelValue[0])
    return option ? option.label : props.placeholder
  }
  
  return `${props.modelValue.length} seleccionados`
})

const isSelected = (value) => {
  return props.modelValue.includes(value)
}

const positionDropdown = () => {
  if (!selectorRef.value || !dropdownRef.value) return
  
  const rect = selectorRef.value.getBoundingClientRect()
  const dropdown = dropdownRef.value
  
  dropdown.style.top = `${rect.bottom + 4}px`
  dropdown.style.left = `${rect.left}px`
  dropdown.style.width = `${rect.width}px`
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      positionDropdown()
    })
  }
}

const toggleOption = (value) => {
  const currentSelection = [...props.modelValue]
  const index = currentSelection.indexOf(value)
  
  if (index > -1) {
    // Deseleccionar
    currentSelection.splice(index, 1)
  } else {
    // Seleccionar (verificar límite máximo)
    if (props.maxSelections && currentSelection.length >= props.maxSelections) {
      return
    }
    currentSelection.push(value)
  }
  
  emit('update:modelValue', currentSelection)
}

const closeDropdown = (event) => {
  if (!event.target.closest('.multi-selector')) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<style scoped>
.multi-selector {
  position: relative;
  width: 100%;
  z-index: 999998 !important;
}

.selector-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #e0e0e0;
  font-weight: 500;
}

.selector-container {
  position: relative;
  z-index: 1;
}

.selector-container.active {
  z-index: 2147483647 !important;
}

.selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #1a1a1a !important;
  border: 1px solid #666666 !important;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 44px;
}

.selector-header:hover {
  background: #2a2a2a !important;
  border-color: #00d9ff !important;
}

.selector-header.active {
  border-color: #00d9ff;
  box-shadow: 0 0 8px #00d9ff !important;
}

.selected-text {
  flex: 1;
  color: #e0e0e0;
  font-size: 0.9rem;
}

.dropdown-arrow {
  color: #00d9ff;
  font-size: 0.8rem;
  transition: transform 0.3s ease;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.selector-dropdown {
  position: fixed !important;
  background: #000000 !important;
  border: 3px solid #00d9ff !important;
  border-radius: 8px;
  box-shadow: 0 8px 24px #00d9ff !important;
  z-index: 2147483647 !important;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
  visibility: visible !important;
  display: block !important;
}

.selector-option {
  display: flex !important;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid #666666 !important;
  background: #1a1a1a !important;
  visibility: visible !important;
}

.selector-option:last-child {
  border-bottom: none;
}

.selector-option:hover {
  background: #003d4d !important;
}

.selector-option.selected {
  background: #004d66 !important;
  border-left: 3px solid #00d9ff;
}

.option-checkbox {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #666666 !important;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #00d9ff;
  font-weight: bold;
  flex-shrink: 0;
  margin-top: 2px;
}

.selector-option.selected .option-checkbox {
  border-color: #00d9ff;
  background: #003d4d !important;
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.option-label {
  color: #ffffff !important;
  font-size: 0.9rem;
  font-weight: 700 !important;
}

.option-description {
  color: #cccccc !important;
  font-size: 0.8rem;
  line-height: 1.3;
}

/* Scrollbar personalizado para el dropdown */
.selector-dropdown::-webkit-scrollbar {
  width: 6px;
}

.selector-dropdown::-webkit-scrollbar-track {
  background: #333333 !important;
  border-radius: 3px;
}

.selector-dropdown::-webkit-scrollbar-thumb {
  background: #00d9ff !important;
  border-radius: 3px;
}

.selector-dropdown::-webkit-scrollbar-thumb:hover {
  background: #00b8d4 !important;
}
</style>