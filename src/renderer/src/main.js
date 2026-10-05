import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initObservability } from './lib/observability.js'
import { installRipple } from './lib/ripple.js'
import './styles/global.css'
import './styles/ink.css'

const app = createApp(App)
app.use(createPinia())
initObservability(app)
app.mount('#app')
installRipple()
