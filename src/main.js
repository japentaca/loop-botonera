import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'

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

// Importar iconos
import 'primeicons/primeicons.css'

import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// Configurar PrimeVue con tema Aura
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

// Registrar componentes globalmente
app.component('Button', Button)
app.component('Slider', Slider)
app.component('InputNumber', InputNumber)
app.component('Dialog', Dialog)
app.component('Badge', Badge)
app.component('ProgressBar', ProgressBar)
app.component('Dropdown', Dropdown)
app.component('MultiSelect', MultiSelect)
app.component('Checkbox', Checkbox)

app.use(pinia)
app.mount('#app')