console.log('🟢 MAIN: Starting main.js initialization');
console.log('🟢 MAIN: Current time:', new Date().toISOString());

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'

console.log('🟢 MAIN: Vue, Pinia, and PrimeVue imports loaded');

// Importar componentes PrimeVue que usaremos
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import InputNumber from 'primevue/inputnumber'
import Dialog from 'primevue/dialog'
import Badge from 'primevue/badge'
import ProgressBar from 'primevue/progressbar'
import Dropdown from 'primevue/dropdown'
import MultiSelect from 'primevue/multiselect'
import Checkbox from 'primevue/checkbox'

console.log('🟢 MAIN: PrimeVue components imported');

// Importar iconos
import 'primeicons/primeicons.css'

console.log('🟢 MAIN: PrimeIcons CSS imported');

import App from './App.vue'
import './style.css'

console.log('🟢 MAIN: App.vue and styles imported');

console.log('🟢 MAIN: Creating Vue app and Pinia store');
const app = createApp(App)
const pinia = createPinia()
console.log('🟢 MAIN: Vue app and Pinia store created');

// Configurar PrimeVue con tema Aura
console.log('🟢 MAIN: Configuring PrimeVue with Aura theme');
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark-mode',
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities'
      }
    }
  }
})
console.log('🟢 MAIN: PrimeVue configured');

// Registrar componentes globalmente
console.log('🟢 MAIN: Registering global components');
app.component('Button', Button)
app.component('Slider', Slider)
app.component('InputNumber', InputNumber)
app.component('Dialog', Dialog)
app.component('Badge', Badge)
app.component('ProgressBar', ProgressBar)
app.component('Dropdown', Dropdown)
app.component('MultiSelect', MultiSelect)
app.component('Checkbox', Checkbox)
console.log('🟢 MAIN: Global components registered');

console.log('🟢 MAIN: Using Pinia store');
app.use(pinia)
console.log('🟢 MAIN: Pinia store applied');

console.log('🟢 MAIN: Mounting Vue app to #app element');
app.mount('#app')
console.log('🟢 MAIN: Vue app mounted successfully');